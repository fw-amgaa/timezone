import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and, lt } from "@timezone/database";
import { shifts, users } from "@timezone/database/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * STALE SHIFT DETECTION & RESOLUTION (Web Dashboard)
 *
 * A shift becomes "stale" when it's been open for more than 16 hours.
 * This typically indicates the employee forgot to clock out.
 *
 * Manager Resolution Flow:
 * 1. Dashboard shows stale shifts
 * 2. Manager can choose to:
 *    - Close with 0 hours (employee forgot)
 *    - Set actual clock-out time
 * 3. Shift status becomes "revised"
 */

// GET: Get all stale shifts for the organization
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, error: "User not found or no organization" },
        { status: 404 }
      );
    }

    // Check authorization
    if (!["org_admin", "org_manager", "super_admin"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const sixteenHoursAgo = new Date(Date.now() - 16 * 60 * 60 * 1000);

    const staleShifts = await db.query.shifts.findMany({
      where: and(
        eq(shifts.organizationId, user.organizationId),
        eq(shifts.status, "open"),
        lt(shifts.clockInAt, sixteenHoursAgo)
      ),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        location: {
          columns: {
            name: true,
          },
        },
      },
      orderBy: [shifts.clockInAt],
    });

    const now = new Date();
    return NextResponse.json({
      success: true,
      hasStaleShifts: staleShifts.length > 0,
      staleShifts: staleShifts.map((s) => {
        const hoursOpen = Math.floor(
          (now.getTime() - s.clockInAt.getTime()) / (1000 * 60 * 60)
        );
        return {
          id: s.id,
          user: {
            id: s.user.id,
            name: `${s.user.firstName} ${s.user.lastName}`,
            initials: `${s.user.firstName[0]}${s.user.lastName[0]}`,
          },
          clockInAt: s.clockInAt.toISOString(),
          location: s.location?.name || "Unknown",
          hoursOpen,
        };
      }),
    });
  } catch (error) {
    console.error("Get stale shifts error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Resolve schema for POST (Manager resolution)
const resolveSchema = z.object({
  shiftId: z.string().uuid(),
  resolution: z.enum(["forgot", "actual_hours"]),
  actualClockOut: z.string().optional(),
});

// POST: Manager resolves a stale shift
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, error: "User not found or no organization" },
        { status: 404 }
      );
    }

    // Check authorization
    if (!["org_admin", "org_manager", "super_admin"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = resolveSchema.parse(body);

    // Get the shift
    const shift = await db.query.shifts.findFirst({
      where: and(
        eq(shifts.id, data.shiftId),
        eq(shifts.organizationId, user.organizationId)
      ),
    });

    if (!shift) {
      return NextResponse.json(
        { success: false, error: "Shift not found" },
        { status: 404 }
      );
    }

    if (shift.status !== "open") {
      return NextResponse.json(
        { success: false, error: "Shift is not open" },
        { status: 400 }
      );
    }

    const now = new Date();
    let clockOutAt: Date;
    let durationMinutes: number;

    if (data.resolution === "forgot") {
      // Close at clock-in time (0 hours)
      clockOutAt = shift.clockInAt;
      durationMinutes = 0;
    } else {
      // Use actual clock-out time
      if (!data.actualClockOut) {
        return NextResponse.json(
          { success: false, error: "Actual clock-out time is required" },
          { status: 400 }
        );
      }
      clockOutAt = new Date(data.actualClockOut);

      // Validate clock-out is after clock-in
      if (clockOutAt <= shift.clockInAt) {
        return NextResponse.json(
          { success: false, error: "Clock-out must be after clock-in" },
          { status: 400 }
        );
      }

      durationMinutes = Math.round(
        (clockOutAt.getTime() - shift.clockInAt.getTime()) / 60000
      );
    }

    // Update the shift
    const [updatedShift] = await db
      .update(shifts)
      .set({
        status: "revised",
        clockOutAt,
        durationMinutes,
        isRevised: true,
        clockOutNote: `Stale shift resolved by manager: ${
          data.resolution === "forgot"
            ? "Employee forgot to clock out"
            : "Actual hours recorded"
        }`,
        updatedAt: now,
      })
      .where(eq(shifts.id, data.shiftId))
      .returning();

    return NextResponse.json({
      success: true,
      shift: {
        id: updatedShift.id,
        status: updatedShift.status,
        durationMinutes: updatedShift.durationMinutes,
      },
      message: "Shift resolved successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Resolve stale shift error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

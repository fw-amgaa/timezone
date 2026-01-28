import { NextRequest, NextResponse } from "next/server";
import { db, eq, and, desc } from "@timezone/database";
import { shifts } from "@timezone/database/schema";
import { authenticateRequest } from "@/lib/mobile-auth";

/**
 * GET /api/mobile/shifts/current
 *
 * Get the current user's most recent open shift (if any).
 * Used to determine if the next action is clock-in or clock-out.
 */
export async function GET(request: NextRequest) {
  const { user, error } = await authenticateRequest(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Find the most recent open shift for this user
    const openShift = await db.query.shifts.findFirst({
      where: and(
        eq(shifts.userId, user.id),
        eq(shifts.status, "open")
      ),
      orderBy: [desc(shifts.clockInAt)],
    });

    return NextResponse.json({
      success: true,
      shift: openShift
        ? {
            id: openShift.id,
            status: openShift.status,
            clockInAt: openShift.clockInAt.toISOString(),
            clockOutAt: openShift.clockOutAt?.toISOString(),
          }
        : null,
    });
  } catch (error) {
    console.error("Get current shift error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

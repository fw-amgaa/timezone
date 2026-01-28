import { NextRequest, NextResponse } from "next/server";
import { db, eq, and, desc, gte, lte, sql } from "@timezone/database";
import { shifts, orgLocations } from "@timezone/database/schema";
import { authenticateRequest } from "@/lib/mobile-auth";

/**
 * GET /api/mobile/shifts/history
 *
 * Get the user's shift history with optional filtering by period.
 * Query params:
 * - period: "week" | "month" | "all" (default: "week")
 * - limit: number (default: 50)
 * - offset: number (default: 0)
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
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "week";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date | null = null;

    if (period === "week") {
      // Start of current week (Sunday)
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      // Start of current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    // For "all", startDate remains null

    // Build where conditions
    const conditions = [eq(shifts.userId, user.id)];

    if (startDate) {
      conditions.push(gte(shifts.shiftDate, startDate));
    }

    // Fetch shifts
    const userShifts = await db.query.shifts.findMany({
      where: and(...conditions),
      orderBy: [desc(shifts.clockInAt)],
      limit,
      offset,
      with: {
        location: true,
      },
    });

    // Calculate summary stats for the period
    const summaryConditions = [eq(shifts.userId, user.id)];
    if (startDate) {
      summaryConditions.push(gte(shifts.shiftDate, startDate));
    }

    // Get summary data
    const summaryResult = await db
      .select({
        totalShifts: sql<number>`count(*)`,
        totalMinutes: sql<number>`coalesce(sum(${shifts.durationMinutes}), 0)`,
        totalBreakMinutes: sql<number>`coalesce(sum(${shifts.breakMinutes}), 0)`,
        completedShifts: sql<number>`count(*) filter (where ${shifts.status} = 'closed')`,
        activeShifts: sql<number>`count(*) filter (where ${shifts.status} = 'open')`,
      })
      .from(shifts)
      .where(and(...summaryConditions));

    const summary = summaryResult[0] || {
      totalShifts: 0,
      totalMinutes: 0,
      totalBreakMinutes: 0,
      completedShifts: 0,
      activeShifts: 0,
    };

    // Calculate hours
    const totalMinutes = Number(summary.totalMinutes) || 0;
    const totalBreakMinutes = Number(summary.totalBreakMinutes) || 0;
    const netMinutes = totalMinutes - totalBreakMinutes;
    const totalHours = Math.round((netMinutes / 60) * 10) / 10;
    const regularHours = Math.min(totalHours, 40);
    const overtimeHours = Math.max(0, Math.round((totalHours - 40) * 10) / 10);
    const shiftsCompleted = Number(summary.completedShifts) || 0;

    // Calculate days in period for average
    let daysInPeriod = 7;
    if (period === "month") {
      daysInPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    } else if (period === "all" && userShifts.length > 0) {
      const oldestShift = userShifts[userShifts.length - 1];
      const daysDiff = Math.ceil(
        (now.getTime() - new Date(oldestShift.clockInAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      daysInPeriod = Math.max(daysDiff, 1);
    }

    const avgPerDay = Math.round((totalHours / daysInPeriod) * 10) / 10;

    // Format shifts for response
    const formattedShifts = userShifts.map((shift) => {
      const clockInDate = new Date(shift.clockInAt);
      const clockOutDate = shift.clockOutAt ? new Date(shift.clockOutAt) : null;

      // Check if shift crossed midnight
      const crossedMidnight =
        clockOutDate &&
        clockInDate.toDateString() !== clockOutDate.toDateString();

      // Format day of week
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dayOfWeek: string;
      if (clockInDate.toDateString() === today.toDateString()) {
        dayOfWeek = "Today";
      } else if (clockInDate.toDateString() === yesterday.toDateString()) {
        dayOfWeek = "Yesterday";
      } else {
        dayOfWeek = clockInDate.toLocaleDateString("en-US", { weekday: "long" });
      }

      // Map status
      let status: "completed" | "active" | "revised" | "pending" | "stale" = "completed";
      if (shift.status === "open") {
        status = "active";
      } else if (shift.status === "revised" || shift.isRevised) {
        status = "revised";
      } else if (shift.status === "pending_revision") {
        status = "pending";
      } else if (shift.status === "stale") {
        status = "stale";
      }

      return {
        id: shift.id,
        date: clockInDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        dayOfWeek,
        clockIn: clockInDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        clockOut: clockOutDate
          ? clockOutDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })
          : null,
        duration: shift.durationMinutes || 0,
        location: shift.location?.name || "Work Location",
        status,
        crossedMidnight,
        wasOutOfRange:
          shift.clockInLocationStatus === "out_of_range" ||
          shift.clockOutLocationStatus === "out_of_range",
        breakMinutes: shift.breakMinutes || 0,
        // Raw data for additional processing
        clockInAt: shift.clockInAt.toISOString(),
        clockOutAt: shift.clockOutAt?.toISOString() || null,
        shiftDate: shift.shiftDate.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      shifts: formattedShifts,
      summary: {
        totalHours,
        regularHours,
        overtimeHours,
        shiftsCompleted,
        avgPerDay,
        activeShifts: Number(summary.activeShifts) || 0,
      },
      pagination: {
        limit,
        offset,
        total: Number(summary.totalShifts) || 0,
        hasMore: offset + limit < (Number(summary.totalShifts) || 0),
      },
    });
  } catch (error) {
    console.error("Get shift history error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

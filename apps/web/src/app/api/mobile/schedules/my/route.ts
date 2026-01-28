import { NextRequest, NextResponse } from "next/server";
import { db, eq, and, or, isNull, gte, lte } from "@timezone/database";
import {
  scheduleAssignments,
  scheduleTemplates,
  scheduleSlots,
  teamMembers,
} from "@timezone/database/schema";
import { authenticateRequest } from "@/lib/mobile-auth";

/**
 * GET /api/mobile/schedules/my
 *
 * Get the current user's schedule (from team assignments or direct assignments).
 * Returns the schedule template with all slots.
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
    const now = new Date();

    // Get user's team memberships
    const userTeams = await db.query.teamMembers.findMany({
      where: eq(teamMembers.userId, user.id),
    });
    const userTeamIds = userTeams.map((t) => t.teamId);

    // Get active schedule assignments for user (direct or through teams)
    // Priority: Direct user assignments take precedence over team assignments
    let activeAssignment = null;

    // First, check for direct user assignment
    const directAssignment = await db.query.scheduleAssignments.findFirst({
      where: and(
        eq(scheduleAssignments.userId, user.id),
        eq(scheduleAssignments.isActive, true),
        or(
          isNull(scheduleAssignments.effectiveFrom),
          lte(scheduleAssignments.effectiveFrom, now)
        ),
        or(
          isNull(scheduleAssignments.effectiveUntil),
          gte(scheduleAssignments.effectiveUntil, now)
        )
      ),
      with: {
        template: {
          with: {
            slots: true,
          },
        },
      },
    });

    if (directAssignment) {
      activeAssignment = directAssignment;
    } else if (userTeamIds.length > 0) {
      // Check for team assignment
      for (const teamId of userTeamIds) {
        const teamAssignment = await db.query.scheduleAssignments.findFirst({
          where: and(
            eq(scheduleAssignments.teamId, teamId),
            eq(scheduleAssignments.isActive, true),
            or(
              isNull(scheduleAssignments.effectiveFrom),
              lte(scheduleAssignments.effectiveFrom, now)
            ),
            or(
              isNull(scheduleAssignments.effectiveUntil),
              gte(scheduleAssignments.effectiveUntil, now)
            )
          ),
          with: {
            template: {
              with: {
                slots: true,
              },
            },
          },
        });

        if (teamAssignment) {
          activeAssignment = teamAssignment;
          break;
        }
      }
    }

    if (!activeAssignment || !activeAssignment.template) {
      return NextResponse.json({
        success: true,
        hasSchedule: false,
        schedule: null,
        message: "No schedule assigned",
      });
    }

    const template = activeAssignment.template;

    // Sort slots by day of week for consistent ordering
    const dayOrder = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    const sortedSlots = [...template.slots].sort(
      (a, b) => dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek)
    );

    return NextResponse.json({
      success: true,
      hasSchedule: true,
      schedule: {
        templateId: template.id,
        templateName: template.name,
        templateColor: template.color,
        slots: sortedSlots.map((slot) => ({
          id: slot.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          crossesMidnight: slot.crossesMidnight,
          breakMinutes: slot.breakMinutes,
        })),
        effectiveFrom: activeAssignment.effectiveFrom?.toISOString() || null,
        effectiveUntil: activeAssignment.effectiveUntil?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Get user schedule error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

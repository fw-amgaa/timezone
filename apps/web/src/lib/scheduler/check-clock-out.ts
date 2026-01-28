/**
 * Clock-out reminder checker
 * Sends notifications when employees forget to clock out after their shift ends
 */

import { db, eq, and, isNull, isNotNull, lt, gte, inArray } from "@timezone/database";
import {
  users,
  organizations,
  shifts,
  scheduleAssignments,
  scheduleSlots,
  scheduledNotifications,
  teamMembers,
  OrgLocaleSettings,
} from "@timezone/database/schema";
import { sendNotification } from "./push-sender";
import {
  getCurrentTimeStringInTimezone,
  getDayOfWeekInTimezone,
  getPreviousDay,
  shouldSendClockOutReminder,
  generateNotificationKey,
  DayOfWeek,
  parseTimeToMinutes,
} from "./utils";

interface ActiveShiftInfo {
  userId: string;
  organizationId: string;
  shiftId: string;
  templateName: string;
  slotId: string;
  endTime: string;
  crossesMidnight: boolean;
}

/**
 * Get all users with active time entries and their scheduled end times
 */
async function getActiveShiftsWithSchedules(
  organizationId: string,
  currentDay: DayOfWeek,
  timezone: string
): Promise<ActiveShiftInfo[]> {
  const results: ActiveShiftInfo[] = [];

  // Get all active shifts (clocked in but not clocked out)
  const activeEntries = await db.query.shifts.findMany({
    where: and(
      eq(shifts.organizationId, organizationId),
      isNotNull(shifts.clockInAt),
      isNull(shifts.clockOutAt)
    ),
    columns: {
      id: true,
      userId: true,
      clockInAt: true,
    },
  });

  for (const entry of activeEntries) {
    // Find this user's schedule
    const userSchedule = await getUserScheduledEndTime(
      entry.userId,
      organizationId,
      currentDay
    );

    if (userSchedule) {
      results.push({
        userId: entry.userId,
        organizationId,
        shiftId: entry.id,
        templateName: userSchedule.templateName,
        slotId: userSchedule.slotId,
        endTime: userSchedule.endTime,
        crossesMidnight: userSchedule.crossesMidnight,
      });
    }
  }

  return results;
}

/**
 * Get user's scheduled end time for the current period
 */
async function getUserScheduledEndTime(
  userId: string,
  organizationId: string,
  currentDay: DayOfWeek
): Promise<{
  templateName: string;
  slotId: string;
  endTime: string;
  crossesMidnight: boolean;
} | null> {
  // Check for direct user assignment first
  const userAssignment = await db.query.scheduleAssignments.findFirst({
    where: and(
      eq(scheduleAssignments.userId, userId),
      eq(scheduleAssignments.isActive, true)
    ),
    with: {
      template: {
        with: {
          slots: true,
        },
      },
    },
  });

  if (userAssignment?.template) {
    const slot = findRelevantSlot(
      userAssignment.template.slots,
      currentDay
    );
    if (slot) {
      return {
        templateName: userAssignment.template.name,
        slotId: slot.id,
        endTime: slot.endTime,
        crossesMidnight: slot.crossesMidnight ?? false,
      };
    }
  }

  // Check team assignments
  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });

  for (const { teamId } of userTeams) {
    const teamAssignment = await db.query.scheduleAssignments.findFirst({
      where: and(
        eq(scheduleAssignments.teamId, teamId),
        eq(scheduleAssignments.isActive, true)
      ),
      with: {
        template: {
          columns: {
            id: true,
            name: true,
            organizationId: true,
          },
          with: {
            slots: true,
          },
        },
      },
    });

    if (
      teamAssignment?.template &&
      teamAssignment.template.organizationId === organizationId
    ) {
      const slot = findRelevantSlot(
        teamAssignment.template.slots,
        currentDay
      );
      if (slot) {
        return {
          templateName: teamAssignment.template.name,
          slotId: slot.id,
          endTime: slot.endTime,
          crossesMidnight: slot.crossesMidnight ?? false,
        };
      }
    }
  }

  return null;
}

/**
 * Find the relevant slot for clock-out reminder
 * For regular shifts: check current day
 * For night shifts: check previous day (shift that started yesterday, ends today)
 */
function findRelevantSlot(
  slots: Array<{
    id: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    crossesMidnight: boolean | null;
  }>,
  currentDay: DayOfWeek
): {
  id: string;
  endTime: string;
  crossesMidnight: boolean;
} | null {
  // First check for regular shifts ending today
  const todaySlot = slots.find(
    (s) => s.dayOfWeek === currentDay && !s.crossesMidnight
  );
  if (todaySlot) {
    return {
      id: todaySlot.id,
      endTime: todaySlot.endTime,
      crossesMidnight: false,
    };
  }

  // Check for night shifts that started yesterday
  const previousDay = getPreviousDay(currentDay);
  const nightSlot = slots.find(
    (s) => s.dayOfWeek === previousDay && s.crossesMidnight
  );
  if (nightSlot) {
    return {
      id: nightSlot.id,
      endTime: nightSlot.endTime,
      crossesMidnight: true,
    };
  }

  // Check for night shifts starting today (will end tomorrow)
  const tonightSlot = slots.find(
    (s) => s.dayOfWeek === currentDay && s.crossesMidnight
  );
  if (tonightSlot) {
    return {
      id: tonightSlot.id,
      endTime: tonightSlot.endTime,
      crossesMidnight: true,
    };
  }

  return null;
}

/**
 * Check if notification was already sent today
 */
async function wasClockOutReminderSent(
  userId: string,
  slotId: string,
  today: Date
): Promise<boolean> {
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const existing = await db.query.scheduledNotifications.findFirst({
    where: and(
      eq(scheduledNotifications.userId, userId),
      eq(scheduledNotifications.scheduleSlotId, slotId),
      eq(scheduledNotifications.type, "clock_out_reminder"),
      eq(scheduledNotifications.status, "sent"),
      gte(scheduledNotifications.processedAt, startOfDay)
    ),
  });

  return !!existing;
}

/**
 * Record that clock-out reminder was sent
 */
async function recordClockOutReminderSent(
  userId: string,
  organizationId: string,
  slotId: string,
  scheduledFor: Date
): Promise<void> {
  await db.insert(scheduledNotifications).values({
    userId,
    organizationId,
    scheduleSlotId: slotId,
    type: "clock_out_reminder",
    scheduledFor,
    status: "sent",
    processedAt: new Date(),
  });
}

/**
 * Main function to check and send clock-out reminders
 */
export async function checkClockOutReminders(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
}> {
  const stats = { processed: 0, sent: 0, skipped: 0, errors: 0 };

  try {
    // Get all active organizations
    const orgs = await db.query.organizations.findMany({
      where: eq(organizations.isActive, true),
      columns: {
        id: true,
        localeSettings: true,
      },
    });

    for (const org of orgs) {
      const timezone =
        (org.localeSettings as OrgLocaleSettings | null)?.timezone || "UTC";
      const currentTime = getCurrentTimeStringInTimezone(timezone);
      const currentDay = getDayOfWeekInTimezone(timezone);
      const today = new Date();

      // Get active shifts with their scheduled end times
      const activeShifts = await getActiveShiftsWithSchedules(
        org.id,
        currentDay,
        timezone
      );

      for (const shift of activeShifts) {
        stats.processed++;

        // Check if it's 15 minutes after their scheduled end time
        const shouldRemind = shouldSendClockOutReminder(
          currentTime,
          shift.endTime
        );

        if (!shouldRemind) {
          continue;
        }

        // Check if reminder already sent
        const alreadySent = await wasClockOutReminderSent(
          shift.userId,
          shift.slotId,
          today
        );

        if (alreadySent) {
          stats.skipped++;
          continue;
        }

        // Send reminder
        try {
          await sendNotification({
            userId: shift.userId,
            organizationId: shift.organizationId,
            type: "clock_out_reminder",
            title: "Did You Forget to Clock Out?",
            message: `Your ${shift.templateName} shift ended at ${shift.endTime}. Don't forget to clock out!`,
            data: {
              screen: "clock" as const,
              shiftId: shift.shiftId,
            },
          });

          await recordClockOutReminderSent(
            shift.userId,
            shift.organizationId,
            shift.slotId,
            today
          );

          stats.sent++;
        } catch (error) {
          console.error(
            `Error sending clock-out reminder to ${shift.userId}:`,
            error
          );
          stats.errors++;
        }
      }
    }
  } catch (error) {
    console.error("Error in checkClockOutReminders:", error);
    throw error;
  }

  return stats;
}

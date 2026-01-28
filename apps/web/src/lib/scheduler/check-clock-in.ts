/**
 * Clock-in reminder checker
 * Sends notifications before and at shift start time
 */

import { db, eq, and, isNull, gte, lte, inArray } from "@timezone/database";
import {
  users,
  organizations,
  shifts,
  scheduleAssignments,
  scheduleSlots,
  scheduleTemplates,
  scheduledNotifications,
  teamMembers,
  OrgLocaleSettings,
} from "@timezone/database/schema";
import { sendNotification } from "./push-sender";
import {
  getCurrentTimeStringInTimezone,
  getDayOfWeekInTimezone,
  getNotificationWindow,
  generateNotificationKey,
  DayOfWeek,
} from "./utils";

interface ScheduledSlot {
  slotId: string;
  userId: string;
  organizationId: string;
  templateName: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
}

/**
 * Get all scheduled slots for the current day/time window
 */
async function getScheduledSlotsForDay(
  organizationId: string,
  dayOfWeek: DayOfWeek
): Promise<ScheduledSlot[]> {
  const slots: ScheduledSlot[] = [];

  // Get all active assignments for this organization
  const assignments = await db.query.scheduleAssignments.findMany({
    where: eq(scheduleAssignments.isActive, true),
    with: {
      template: {
        with: {
          slots: true,
        },
      },
    },
  });

  // Filter to this organization's assignments
  const orgAssignments = assignments.filter(
    (a) => a.template?.organizationId === organizationId
  );

  for (const assignment of orgAssignments) {
    if (!assignment.template) continue;

    // Get slots for current day
    const daySlots = assignment.template.slots.filter(
      (s) => s.dayOfWeek === dayOfWeek
    );

    // Get users for this assignment
    let userIds: string[] = [];

    if (assignment.userId) {
      // Direct user assignment
      userIds = [assignment.userId];
    } else if (assignment.teamId) {
      // Team assignment - get all team members
      const members = await db.query.teamMembers.findMany({
        where: eq(teamMembers.teamId, assignment.teamId),
        columns: { userId: true },
      });
      userIds = members.map((m) => m.userId);
    }

    // Add slots for each user
    for (const slot of daySlots) {
      for (const userId of userIds) {
        slots.push({
          slotId: slot.id,
          userId,
          organizationId,
          templateName: assignment.template.name,
          startTime: slot.startTime,
          endTime: slot.endTime,
          crossesMidnight: slot.crossesMidnight ?? false,
        });
      }
    }
  }

  return slots;
}

/**
 * Check if user is already clocked in
 */
async function isUserClockedIn(userId: string): Promise<boolean> {
  const activeEntry = await db.query.shifts.findFirst({
    where: and(eq(shifts.userId, userId), isNull(shifts.clockOutAt)),
  });
  return !!activeEntry;
}

/**
 * Check if notification was already sent
 */
async function wasNotificationSent(
  userId: string,
  slotId: string,
  type: string,
  today: Date
): Promise<boolean> {
  const key = generateNotificationKey(userId, slotId, type, today);

  const existing = await db.query.scheduledNotifications.findFirst({
    where: and(
      eq(scheduledNotifications.userId, userId),
      eq(scheduledNotifications.scheduleSlotId, slotId),
      eq(scheduledNotifications.type, type as any),
      eq(scheduledNotifications.status, "sent")
    ),
  });

  return !!existing;
}

/**
 * Record that a notification was sent
 */
async function recordNotificationSent(
  userId: string,
  organizationId: string,
  slotId: string,
  type: string,
  scheduledFor: Date
): Promise<void> {
  await db.insert(scheduledNotifications).values({
    userId,
    organizationId,
    scheduleSlotId: slotId,
    type: type,
    scheduledFor,
    status: "sent",
    processedAt: new Date(),
  });
}

/**
 * Record skipped notification
 */
async function recordNotificationSkipped(
  userId: string,
  organizationId: string,
  slotId: string,
  type: string,
  scheduledFor: Date,
  reason: string
): Promise<void> {
  await db.insert(scheduledNotifications).values({
    userId,
    organizationId,
    scheduleSlotId: slotId,
    type: type,
    scheduledFor,
    status: "skipped",
    processedAt: new Date(),
    skipReason: reason,
  });
}

/**
 * Get notification title and message based on window
 */
function getNotificationContent(
  window: "before_15" | "before_5" | "at_time" | "after_15",
  templateName: string,
  startTime: string
): { title: string; message: string } {
  switch (window) {
    case "before_15":
      return {
        title: "Shift Starting Soon",
        message: `Your ${templateName} shift starts at ${startTime}. Get ready!`,
      };
    case "before_5":
      return {
        title: "Shift Starts in 5 Minutes",
        message: `Your ${templateName} shift starts at ${startTime}. Time to clock in!`,
      };
    case "at_time":
      return {
        title: "Your Shift Has Started",
        message: `Your ${templateName} shift started at ${startTime}. Please clock in now.`,
      };
    case "after_15":
      return {
        title: "You're Late!",
        message: `Your ${templateName} shift started at ${startTime}. You're 15 minutes late. Please clock in immediately.`,
      };
  }
}

/**
 * Main function to check and send clock-in reminders
 */
export async function checkClockInReminders(): Promise<{
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

      // Get scheduled slots for this org
      const slots = await getScheduledSlotsForDay(org.id, currentDay);

      for (const slot of slots) {
        stats.processed++;

        // Check which notification window we're in
        const window = getNotificationWindow(currentTime, slot.startTime);
        if (!window) {
          continue; // Not in any notification window
        }

        // Check if already clocked in
        const isClockedIn = await isUserClockedIn(slot.userId);
        if (isClockedIn) {
          await recordNotificationSkipped(
            slot.userId,
            slot.organizationId,
            slot.slotId,
            `clock_in_${window}`,
            today,
            "already_clocked_in"
          );
          stats.skipped++;
          continue;
        }

        // Check if notification already sent
        const alreadySent = await wasNotificationSent(
          slot.userId,
          slot.slotId,
          `clock_in_${window}`,
          today
        );
        if (alreadySent) {
          stats.skipped++;
          continue;
        }

        // Send notification
        const { title, message } = getNotificationContent(
          window,
          slot.templateName,
          slot.startTime
        );

        try {
          await sendNotification({
            userId: slot.userId,
            organizationId: slot.organizationId,
            type: "clock_in_reminder",
            title,
            message,
            data: {
              screen: "clock" as const,
              slotId: slot.slotId,
              scheduledTime: slot.startTime,
            },
          });

          await recordNotificationSent(
            slot.userId,
            slot.organizationId,
            slot.slotId,
            `clock_in_${window}`,
            today
          );

          stats.sent++;

          // If 15 minutes late, also notify manager
          if (window === "after_15") {
            await notifyManager(slot, currentTime);
          }
        } catch (error) {
          console.error(
            `Error sending clock-in reminder to ${slot.userId}:`,
            error
          );
          stats.errors++;
        }
      }
    }
  } catch (error) {
    console.error("Error in checkClockInReminders:", error);
    throw error;
  }

  return stats;
}

/**
 * Notify manager when employee is late
 */
async function notifyManager(slot: ScheduledSlot, currentTime: string): Promise<void> {
  // Get the employee's info
  const employee = await db.query.users.findFirst({
    where: eq(users.id, slot.userId),
    columns: { id: true, name: true, firstName: true, lastName: true },
  });

  if (!employee) return;

  const employeeName =
    employee.name ||
    [employee.firstName, employee.lastName].filter(Boolean).join(" ") ||
    "An employee";

  // Get managers for this organization
  const managers = await db.query.users.findMany({
    where: and(
      eq(users.organizationId, slot.organizationId),
      eq(users.isActive, true),
      inArray(users.role, ["org_admin", "org_manager"])
    ),
    columns: { id: true },
  });

  for (const manager of managers) {
    try {
      await sendNotification({
        userId: manager.id,
        organizationId: slot.organizationId,
        type: "manager_alert",
        title: "Employee Late Alert",
        message: `${employeeName} is 15+ minutes late for their ${slot.templateName} shift (${slot.startTime}).`,
        data: {
          screen: "time-entries" as const,
          employeeId: slot.userId,
        },
      });
    } catch (error) {
      console.error(`Error notifying manager ${manager.id}:`, error);
    }
  }
}

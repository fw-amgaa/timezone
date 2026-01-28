/**
 * Weekly summary notification generator
 * Sends weekly work hour summaries to all employees
 */

import { db, eq, and, gte, lt, isNotNull } from "@timezone/database";
import {
  users,
  organizations,
  timeEntries,
  OrgLocaleSettings,
} from "@timezone/database/schema";
import { sendNotification } from "./push-sender";
import { getWeekStart, formatDuration } from "./utils";

interface WeeklySummaryData {
  userId: string;
  organizationId: string;
  userName: string;
  totalMinutes: number;
  shiftCount: number;
  avgShiftMinutes: number;
  weekStart: Date;
  weekEnd: Date;
}

/**
 * Calculate weekly summary for a user
 */
async function calculateUserWeeklySummary(
  userId: string,
  organizationId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<{
  totalMinutes: number;
  shiftCount: number;
}> {
  const entries = await db.query.timeEntries.findMany({
    where: and(
      eq(timeEntries.userId, userId),
      gte(timeEntries.clockIn, weekStart),
      lt(timeEntries.clockIn, weekEnd),
      isNotNull(timeEntries.clockOut)
    ),
    columns: {
      clockIn: true,
      clockOut: true,
      breakMinutes: true,
    },
  });

  let totalMinutes = 0;
  let shiftCount = 0;

  for (const entry of entries) {
    if (entry.clockIn && entry.clockOut) {
      const durationMs = entry.clockOut.getTime() - entry.clockIn.getTime();
      const durationMinutes = Math.round(durationMs / 60000);
      const breakMinutes = entry.breakMinutes || 0;
      const netMinutes = Math.max(0, durationMinutes - breakMinutes);

      totalMinutes += netMinutes;
      shiftCount++;
    }
  }

  return { totalMinutes, shiftCount };
}

/**
 * Get week date range display
 */
function getWeekRangeDisplay(weekStart: Date, weekEnd: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const startStr = weekStart.toLocaleDateString("en-US", options);
  const endStr = new Date(weekEnd.getTime() - 1).toLocaleDateString(
    "en-US",
    options
  );
  return `${startStr} - ${endStr}`;
}

/**
 * Generate and send weekly summaries for an organization
 */
async function sendOrgWeeklySummaries(
  organizationId: string,
  timezone: string,
  weekStartsOn: number
): Promise<{ sent: number; errors: number }> {
  const stats = { sent: 0, errors: 0 };

  // Calculate week boundaries
  const weekEnd = new Date();
  const weekStart = getWeekStart(timezone, weekStartsOn);
  weekEnd.setHours(23, 59, 59, 999);

  // Get all active employees
  const employees = await db.query.users.findMany({
    where: and(
      eq(users.organizationId, organizationId),
      eq(users.isActive, true)
    ),
    columns: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
    },
  });

  for (const employee of employees) {
    try {
      const { totalMinutes, shiftCount } = await calculateUserWeeklySummary(
        employee.id,
        organizationId,
        weekStart,
        weekEnd
      );

      // Only send if they had at least one shift
      if (shiftCount === 0) {
        continue;
      }

      const userName =
        employee.name ||
        [employee.firstName, employee.lastName].filter(Boolean).join(" ") ||
        "there";

      const weekRange = getWeekRangeDisplay(weekStart, weekEnd);
      const avgMinutes =
        shiftCount > 0 ? Math.round(totalMinutes / shiftCount) : 0;

      const message = buildSummaryMessage(
        userName,
        totalMinutes,
        shiftCount,
        avgMinutes,
        weekRange
      );

      await sendNotification({
        userId: employee.id,
        organizationId,
        type: "weekly_summary",
        title: "Your Weekly Summary",
        message,
        data: {
          screen: "history" as const,
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          totalMinutes,
          shiftCount,
        },
      });

      stats.sent++;
    } catch (error) {
      console.error(
        `Error sending weekly summary to ${employee.id}:`,
        error
      );
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Build the summary message
 */
function buildSummaryMessage(
  userName: string,
  totalMinutes: number,
  shiftCount: number,
  avgMinutes: number,
  weekRange: string
): string {
  const totalFormatted = formatDuration(totalMinutes);
  const avgFormatted = formatDuration(avgMinutes);

  const lines = [
    `Hi ${userName}! Here's your week in review (${weekRange}):`,
    ``,
    `Total hours: ${totalFormatted}`,
    `Shifts completed: ${shiftCount}`,
    `Average shift: ${avgFormatted}`,
  ];

  // Add encouragement based on hours
  const hours = totalMinutes / 60;
  if (hours >= 40) {
    lines.push(``, `Great job this week! You've put in solid work.`);
  } else if (hours >= 20) {
    lines.push(``, `Nice work this week!`);
  }

  return lines.join("\n");
}

/**
 * Main function to send weekly summaries to all organizations
 */
export async function sendWeeklySummaries(): Promise<{
  organizations: number;
  sent: number;
  errors: number;
}> {
  const stats = { organizations: 0, sent: 0, errors: 0 };

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
      stats.organizations++;

      const localeSettings = org.localeSettings as OrgLocaleSettings | null;
      const timezone = localeSettings?.timezone || "UTC";
      const weekStartsOn = localeSettings?.weekStartsOn ?? 0;

      const orgStats = await sendOrgWeeklySummaries(
        org.id,
        timezone,
        weekStartsOn
      );

      stats.sent += orgStats.sent;
      stats.errors += orgStats.errors;
    }
  } catch (error) {
    console.error("Error in sendWeeklySummaries:", error);
    throw error;
  }

  return stats;
}

/**
 * Send weekly summary to a specific user (for testing or manual trigger)
 */
export async function sendUserWeeklySummary(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        organizationId: true,
      },
    });

    if (!user || !user.organizationId) {
      return { success: false, error: "User not found" };
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, user.organizationId),
      columns: { localeSettings: true },
    });

    const localeSettings = org?.localeSettings as OrgLocaleSettings | null;
    const timezone = localeSettings?.timezone || "UTC";
    const weekStartsOn = localeSettings?.weekStartsOn ?? 0;

    const weekEnd = new Date();
    const weekStart = getWeekStart(timezone, weekStartsOn);
    weekEnd.setHours(23, 59, 59, 999);

    const { totalMinutes, shiftCount } = await calculateUserWeeklySummary(
      userId,
      user.organizationId,
      weekStart,
      weekEnd
    );

    const userName =
      user.name ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      "there";

    const weekRange = getWeekRangeDisplay(weekStart, weekEnd);
    const avgMinutes =
      shiftCount > 0 ? Math.round(totalMinutes / shiftCount) : 0;

    const message = buildSummaryMessage(
      userName,
      totalMinutes,
      shiftCount,
      avgMinutes,
      weekRange
    );

    await sendNotification({
      userId,
      organizationId: user.organizationId,
      type: "weekly_summary",
      title: "Your Weekly Summary",
      message,
      data: {
        screen: "history" as const,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        totalMinutes,
        shiftCount,
      },
    });

    return { success: true };
  } catch (error) {
    console.error(`Error sending weekly summary to ${userId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

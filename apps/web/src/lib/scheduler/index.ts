/**
 * Scheduler Service
 *
 * Main entry point for all scheduled notification tasks.
 * This module coordinates clock-in reminders, clock-out reminders,
 * and weekly summaries.
 *
 * Notification Timing:
 * - 15 minutes before shift start
 * - 5 minutes before shift start
 * - At shift start time (if not clocked in)
 * - 15 minutes after shift start (if not clocked in) + manager alert
 * - 15 minutes after shift end (if still clocked in)
 *
 * Designed to be called by external cron jobs every minute.
 */

export { checkClockInReminders } from "./check-clock-in";
export { checkClockOutReminders } from "./check-clock-out";
export { sendWeeklySummaries, sendUserWeeklySummary } from "./weekly-summary";
export { sendNotification, sendBatchNotifications, sendOrgWideNotification } from "./push-sender";
export * from "./utils";

/**
 * Run all notification checks
 * This should be called every minute by a cron job
 */
export async function runNotificationChecks(): Promise<{
  clockIn: { processed: number; sent: number; skipped: number; errors: number };
  clockOut: { processed: number; sent: number; skipped: number; errors: number };
  totalSent: number;
  totalErrors: number;
}> {
  const { checkClockInReminders } = await import("./check-clock-in");
  const { checkClockOutReminders } = await import("./check-clock-out");

  const [clockInStats, clockOutStats] = await Promise.all([
    checkClockInReminders(),
    checkClockOutReminders(),
  ]);

  return {
    clockIn: clockInStats,
    clockOut: clockOutStats,
    totalSent: clockInStats.sent + clockOutStats.sent,
    totalErrors: clockInStats.errors + clockOutStats.errors,
  };
}

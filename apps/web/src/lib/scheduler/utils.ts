/**
 * Scheduler utility functions for timezone and time calculations
 */

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

const DAY_MAP: Record<number, DayOfWeek> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

/**
 * Get current time in a specific timezone
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const dateParts: Record<string, string> = {};
  for (const part of parts) {
    dateParts[part.type] = part.value;
  }

  // Create a date representing the local time in that timezone
  return new Date(
    parseInt(dateParts.year),
    parseInt(dateParts.month) - 1,
    parseInt(dateParts.day),
    parseInt(dateParts.hour),
    parseInt(dateParts.minute),
    parseInt(dateParts.second)
  );
}

/**
 * Get day of week in a specific timezone
 */
export function getDayOfWeekInTimezone(timezone: string): DayOfWeek {
  const localTime = getCurrentTimeInTimezone(timezone);
  return DAY_MAP[localTime.getDay()];
}

/**
 * Get current time as HH:MM string in a specific timezone
 */
export function getCurrentTimeStringInTimezone(timezone: string): string {
  const localTime = getCurrentTimeInTimezone(timezone);
  const hours = localTime.getHours().toString().padStart(2, "0");
  const minutes = localTime.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Parse HH:MM time string to minutes since midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to HH:MM format
 */
export function minutesToTimeString(minutes: number): string {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440; // Handle negative and >24h
  const h = Math.floor(normalizedMinutes / 60);
  const m = normalizedMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Check if current time is within a window of the target time
 * Returns: "before_15", "before_5", "at_time", "after_15", or null
 */
export function getNotificationWindow(
  currentTimeStr: string,
  targetTimeStr: string
): "before_15" | "before_5" | "at_time" | "after_15" | null {
  const current = parseTimeToMinutes(currentTimeStr);
  const target = parseTimeToMinutes(targetTimeStr);

  // Calculate difference (accounting for midnight crossover)
  let diff = target - current;
  if (diff < -720) diff += 1440; // If more than 12 hours behind, add a day
  if (diff > 720) diff -= 1440; // If more than 12 hours ahead, subtract a day

  // Check windows (with 1-minute tolerance for cron timing)
  if (diff >= 14 && diff <= 16) return "before_15";
  if (diff >= 4 && diff <= 6) return "before_5";
  if (diff >= -1 && diff <= 1) return "at_time";
  if (diff >= -16 && diff <= -14) return "after_15";

  return null;
}

/**
 * Check if we should send clock-out reminder (15 min after scheduled end)
 */
export function shouldSendClockOutReminder(
  currentTimeStr: string,
  endTimeStr: string
): boolean {
  const current = parseTimeToMinutes(currentTimeStr);
  const end = parseTimeToMinutes(endTimeStr);

  let diff = current - end;
  if (diff < -720) diff += 1440;
  if (diff > 720) diff -= 1440;

  // 15 minutes after end time (with 1-minute tolerance)
  return diff >= 14 && diff <= 16;
}

/**
 * Get the previous day of week
 */
export function getPreviousDay(day: DayOfWeek): DayOfWeek {
  const days: DayOfWeek[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const idx = days.indexOf(day);
  return days[(idx - 1 + 7) % 7];
}

/**
 * Check if a slot is currently active (employee should be working)
 */
export function isSlotCurrentlyActive(
  currentDay: DayOfWeek,
  currentTimeStr: string,
  slotDay: DayOfWeek,
  slotStartTime: string,
  slotEndTime: string,
  crossesMidnight: boolean
): boolean {
  const currentMinutes = parseTimeToMinutes(currentTimeStr);
  const startMinutes = parseTimeToMinutes(slotStartTime);
  const endMinutes = parseTimeToMinutes(slotEndTime);

  if (crossesMidnight) {
    // Night shift: e.g., 18:00-04:00
    // Active if:
    // 1. It's the start day and current time >= start time
    // 2. It's the day after start day and current time < end time
    const nextDay = getNextDay(slotDay);

    if (currentDay === slotDay && currentMinutes >= startMinutes) {
      return true;
    }
    if (currentDay === nextDay && currentMinutes < endMinutes) {
      return true;
    }
  } else {
    // Regular shift: same day, start <= current < end
    if (
      currentDay === slotDay &&
      currentMinutes >= startMinutes &&
      currentMinutes < endMinutes
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Get the next day of week
 */
export function getNextDay(day: DayOfWeek): DayOfWeek {
  const days: DayOfWeek[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const idx = days.indexOf(day);
  return days[(idx + 1) % 7];
}

/**
 * Generate a unique idempotency key for a scheduled notification
 */
export function generateNotificationKey(
  userId: string,
  slotId: string,
  type: string,
  date: Date
): string {
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
  return `${userId}-${slotId}-${type}-${dateStr}`;
}

/**
 * Get the start of the current week (based on org's weekStartsOn setting)
 */
export function getWeekStart(timezone: string, weekStartsOn: number): Date {
  const now = getCurrentTimeInTimezone(timezone);
  const currentDay = now.getDay();
  const diff = (currentDay - weekStartsOn + 7) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Format duration in hours and minutes
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

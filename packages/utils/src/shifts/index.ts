import {
  differenceInMinutes,
  startOfDay,
  format,
  parseISO,
  isAfter,
  isBefore,
  addHours,
} from "date-fns";

/**
 * Shift Duration Result
 */
export interface ShiftDurationResult {
  /** Total minutes worked */
  totalMinutes: number;
  /** Hours component */
  hours: number;
  /** Minutes component (remainder after hours) */
  minutes: number;
  /** Formatted string like "8h 30m" */
  formatted: string;
  /** Whether the shift crossed midnight */
  crossedMidnight: boolean;
  /** The date to attribute this shift to (start date) */
  attributedDate: Date;
  /** Net minutes after break deduction */
  netMinutes: number;
}

/**
 * Calculate shift duration, handling midnight crossings correctly.
 *
 * Key behaviors:
 * - Calculates continuous duration even across midnight
 * - Attributes total hours to the START date of the shift
 * - Handles timezone-aware calculations
 *
 * @example
 * // Shift from 8 PM to 6 AM next day = 10 hours
 * calculateShiftDuration(
 *   new Date("2024-01-15T20:00:00Z"),
 *   new Date("2024-01-16T06:00:00Z")
 * )
 * // Returns { totalMinutes: 600, hours: 10, minutes: 0, ... }
 */
export function calculateShiftDuration(
  clockIn: Date | string,
  clockOut: Date | string,
  breakMinutes: number = 0
): ShiftDurationResult {
  const clockInDate = typeof clockIn === "string" ? parseISO(clockIn) : clockIn;
  const clockOutDate = typeof clockOut === "string" ? parseISO(clockOut) : clockOut;

  // Validate inputs
  if (isAfter(clockInDate, clockOutDate)) {
    throw new Error("Clock in time cannot be after clock out time");
  }

  // Calculate raw duration in minutes
  const totalMinutes = differenceInMinutes(clockOutDate, clockInDate);

  // Check if shift crossed midnight
  const clockInDayStart = startOfDay(clockInDate);
  const clockOutDayStart = startOfDay(clockOutDate);
  const crossedMidnight = clockInDayStart.getTime() !== clockOutDayStart.getTime();

  // Calculate net minutes after break
  const netMinutes = Math.max(0, totalMinutes - breakMinutes);

  // Calculate hours and remaining minutes
  const hours = Math.floor(netMinutes / 60);
  const minutes = netMinutes % 60;

  // Format the duration
  const formatted = formatDuration(hours, minutes);

  return {
    totalMinutes,
    hours,
    minutes,
    formatted,
    crossedMidnight,
    attributedDate: clockInDayStart, // Always attribute to start date
    netMinutes,
  };
}

/**
 * Format duration as "Xh Ym" string
 */
export function formatDuration(hours: number, minutes: number): string {
  if (hours === 0 && minutes === 0) {
    return "0m";
  }
  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * Format duration from total minutes
 */
export function formatDurationFromMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return formatDuration(hours, minutes);
}

/**
 * Check if a shift should be marked as stale.
 * A shift is stale if it's been open for more than the threshold hours.
 *
 * @param clockIn - The clock in timestamp
 * @param thresholdHours - Hours after which shift is considered stale (default 16)
 */
export function isShiftStale(
  clockIn: Date | string,
  thresholdHours: number = 16
): boolean {
  const clockInDate = typeof clockIn === "string" ? parseISO(clockIn) : clockIn;
  const staleThreshold = addHours(clockInDate, thresholdHours);

  return isAfter(new Date(), staleThreshold);
}

/**
 * Get the hours since clock in for an open shift.
 */
export function getOpenShiftHours(clockIn: Date | string): number {
  const clockInDate = typeof clockIn === "string" ? parseISO(clockIn) : clockIn;
  const minutes = differenceInMinutes(new Date(), clockInDate);
  return Math.floor(minutes / 60);
}

/**
 * Validate that a shift duration is within acceptable bounds.
 *
 * @param totalMinutes - Total shift duration in minutes
 * @param minMinutes - Minimum valid duration (default 5 minutes)
 * @param maxMinutes - Maximum valid duration (default 24 hours)
 */
export function validateShiftDuration(
  totalMinutes: number,
  minMinutes: number = 5,
  maxMinutes: number = 1440 // 24 hours
): { valid: boolean; error?: string } {
  if (totalMinutes < minMinutes) {
    return {
      valid: false,
      error: `Shift duration (${totalMinutes} min) is less than minimum (${minMinutes} min)`,
    };
  }

  if (totalMinutes > maxMinutes) {
    return {
      valid: false,
      error: `Shift duration (${totalMinutes} min) exceeds maximum (${maxMinutes} min)`,
    };
  }

  return { valid: true };
}

/**
 * Calculate automatic break deduction based on shift duration.
 *
 * @param totalMinutes - Total shift duration in minutes
 * @param thresholdHours - Hours after which break is auto-deducted
 * @param breakMinutes - Minutes to deduct
 */
export function calculateAutoBreak(
  totalMinutes: number,
  thresholdHours: number = 6,
  breakMinutes: number = 30
): number {
  const thresholdMinutes = thresholdHours * 60;

  if (totalMinutes >= thresholdMinutes) {
    return breakMinutes;
  }

  return 0;
}

/**
 * Parse a shift date range for reporting.
 * Returns start and end of the day in UTC for the given date.
 */
export function getShiftDateRange(date: Date | string): { start: Date; end: Date } {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  const start = startOfDay(dateObj);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

/**
 * Group shifts by their attributed date (for reports).
 * This ensures midnight-crossing shifts are grouped under their start date.
 */
export function groupShiftsByDate<T extends { shiftDate: Date | string }>(
  shifts: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const shift of shifts) {
    const date =
      typeof shift.shiftDate === "string"
        ? parseISO(shift.shiftDate)
        : shift.shiftDate;
    const key = format(date, "yyyy-MM-dd");

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(shift);
  }

  return grouped;
}

/**
 * Calculate weekly overtime hours.
 *
 * @param weeklyMinutes - Total minutes worked in the week
 * @param overtimeThresholdHours - Hours threshold for overtime (default 40)
 */
export function calculateOvertime(
  weeklyMinutes: number,
  overtimeThresholdHours: number = 40
): {
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
} {
  const totalHours = weeklyMinutes / 60;
  const overtimeHours = Math.max(0, totalHours - overtimeThresholdHours);
  const regularHours = Math.min(totalHours, overtimeThresholdHours);

  return {
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
  };
}

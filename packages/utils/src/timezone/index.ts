/**
 * Timezone Utilities
 *
 * All database timestamps are stored in UTC.
 * These utilities help convert to/from organization local time for display.
 */

import {
  format,
  parseISO,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { toZonedTime, fromZonedTime, format as formatTz } from "date-fns-tz";

/**
 * Common IANA timezone identifiers
 */
export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Australia/Sydney",
] as const;

export type CommonTimezone = (typeof COMMON_TIMEZONES)[number];

/**
 * Convert a UTC date to an organization's local timezone.
 */
export function toLocalTime(utcDate: Date | string, timezone: string): Date {
  const date = typeof utcDate === "string" ? parseISO(utcDate) : utcDate;
  return toZonedTime(date, timezone);
}

/**
 * Convert a local time to UTC for storage.
 */
export function toUTC(localDate: Date | string, timezone: string): Date {
  const date = typeof localDate === "string" ? parseISO(localDate) : localDate;
  return fromZonedTime(date, timezone);
}

/**
 * Format a UTC date for display in a specific timezone.
 */
export function formatInTimezone(
  utcDate: Date | string,
  timezone: string,
  formatString: string = "yyyy-MM-dd HH:mm:ss"
): string {
  const date = typeof utcDate === "string" ? parseISO(utcDate) : utcDate;
  return formatTz(toZonedTime(date, timezone), formatString, {
    timeZone: timezone,
  });
}

/**
 * Get the timezone abbreviation for a date (e.g., "EST", "PDT").
 */
export function getTimezoneAbbreviation(date: Date, timezone: string): string {
  return formatTz(toZonedTime(date, timezone), "zzz", { timeZone: timezone });
}

/**
 * Get the UTC offset for a timezone on a specific date.
 * Returns offset in minutes (e.g., -300 for EST, -240 for EDT).
 */
export function getTimezoneOffset(date: Date, timezone: string): number {
  const utcDate = new Date(date.toISOString());
  const localDate = toZonedTime(utcDate, timezone);

  // Calculate difference in minutes
  return Math.round(
    (localDate.getTime() - utcDate.getTime() +
      utcDate.getTimezoneOffset() * 60000) /
      60000
  );
}

/**
 * Format the UTC offset as a string (e.g., "+05:00", "-08:00").
 */
export function formatTimezoneOffset(timezone: string, date: Date = new Date()): string {
  return formatTz(toZonedTime(date, timezone), "xxxxx", { timeZone: timezone });
}

/**
 * Get date ranges in a specific timezone.
 * Useful for generating report queries.
 */
export function getDateRangeInTimezone(
  range: "today" | "week" | "month",
  timezone: string
): { start: Date; end: Date } {
  const now = new Date();
  const localNow = toZonedTime(now, timezone);

  let start: Date;
  let end: Date;

  switch (range) {
    case "today":
      start = startOfDay(localNow);
      end = endOfDay(localNow);
      break;
    case "week":
      start = startOfWeek(localNow, { weekStartsOn: 0 });
      end = endOfWeek(localNow, { weekStartsOn: 0 });
      break;
    case "month":
      start = startOfMonth(localNow);
      end = endOfMonth(localNow);
      break;
  }

  // Convert back to UTC for database queries
  return {
    start: fromZonedTime(start, timezone),
    end: fromZonedTime(end, timezone),
  };
}

/**
 * Format a time for clock display (12h or 24h format).
 */
export function formatClockTime(
  date: Date | string,
  timezone: string,
  use24Hour: boolean = false
): string {
  const formatString = use24Hour ? "HH:mm" : "h:mm a";
  return formatInTimezone(date, timezone, formatString);
}

/**
 * Format a date for display.
 */
export function formatDate(
  date: Date | string,
  timezone: string,
  formatString: string = "MMM d, yyyy"
): string {
  return formatInTimezone(date, timezone, formatString);
}

/**
 * Format a date and time together.
 */
export function formatDateTime(
  date: Date | string,
  timezone: string,
  options: {
    dateFormat?: string;
    timeFormat?: "12h" | "24h";
  } = {}
): string {
  const { dateFormat = "MMM d, yyyy", timeFormat = "12h" } = options;
  const timeString = timeFormat === "24h" ? "HH:mm" : "h:mm a";
  return formatInTimezone(date, timezone, `${dateFormat} ${timeString}`);
}

/**
 * Check if two dates are on the same calendar day in a specific timezone.
 */
export function isSameDayInTimezone(
  date1: Date | string,
  date2: Date | string,
  timezone: string
): boolean {
  const d1 = typeof date1 === "string" ? parseISO(date1) : date1;
  const d2 = typeof date2 === "string" ? parseISO(date2) : date2;

  const local1 = toZonedTime(d1, timezone);
  const local2 = toZonedTime(d2, timezone);

  return format(local1, "yyyy-MM-dd") === format(local2, "yyyy-MM-dd");
}

/**
 * Get the current time in a specific timezone.
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Validate a timezone string.
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all available IANA timezones.
 * Note: This uses Intl.supportedValuesOf which may not be available in all environments.
 */
export function getAllTimezones(): string[] {
  try {
    // @ts-ignore - supportedValuesOf may not be in types
    return Intl.supportedValuesOf("timeZone");
  } catch {
    // Fallback to common timezones
    return [...COMMON_TIMEZONES];
  }
}

import { pgEnum } from "drizzle-orm/pg-core";

// User roles across the system
export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "org_admin",
  "org_manager",
  "employee",
]);

// Organization subscription tiers
export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "starter",
  "professional",
  "enterprise",
]);

// Shift status - the core of our time tracking
export const shiftStatusEnum = pgEnum("shift_status", [
  "open",           // Currently clocked in
  "closed",         // Properly clocked out
  "stale",          // Open for >16 hours, needs resolution
  "pending_revision", // User submitted estimated clock-out, awaiting approval
  "revised",        // Manager approved the revision
]);

// Check-in request status for out-of-range clock-ins
export const requestStatusEnum = pgEnum("request_status", [
  "pending",        // Awaiting manager approval
  "approved",       // Manager approved
  "denied",         // Manager denied
  "auto_expired",   // System expired after 24h
]);

// Location verification status
export const locationStatusEnum = pgEnum("location_status", [
  "in_range",       // Within geofence
  "out_of_range",   // Outside geofence, needs request
  "unknown",        // Location unavailable
  "spoofing_detected", // Server-side verification failed
]);

// OTP verification status
export const otpStatusEnum = pgEnum("otp_status", [
  "pending",
  "verified",
  "expired",
  "max_attempts",
]);

// Audit action types
export const auditActionEnum = pgEnum("audit_action", [
  "clock_in",
  "clock_out",
  "request_submitted",
  "request_approved",
  "request_denied",
  "shift_revised",
  "user_created",
  "user_updated",
  "org_created",
  "org_updated",
  "settings_changed",
]);

// Notification types
export const notificationTypeEnum = pgEnum("notification_type", [
  "request_approved",
  "request_denied",
  "schedule_update",
  "weekly_summary",
  "app_update",
  "clock_in_reminder",
  "clock_out_reminder",
  "manager_alert",
]);

// Type for notification types
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

// Day of week for schedules
export const dayOfWeekEnum = pgEnum("day_of_week", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

// Team member role
export const teamRoleEnum = pgEnum("team_role", [
  "lead",
  "member",
]);

// Scheduled notification status
export const scheduledNotificationStatusEnum = pgEnum("scheduled_notification_status", [
  "pending",
  "sent",
  "skipped",
  "failed",
]);

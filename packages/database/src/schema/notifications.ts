import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { notificationTypeEnum, scheduledNotificationStatusEnum } from "./enums";
import { organizations } from "./organizations";
import { users } from "./users";

// Notification data for deep linking and actions
export type NotificationData = {
  requestId?: string;
  shiftId?: string;
  scheduleId?: string;
  teamId?: string;
  actionUrl?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  totalHours?: number;
  totalShifts?: number;
  [key: string]: unknown;
};

/**
 * NOTIFICATIONS TABLE
 *
 * Stores all notifications for users (in-app and push)
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Target user
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Notification content
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),

    // Optional metadata for deep linking and actions
    data: jsonb("data").$type<NotificationData>(),

    // Read status
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),

    // Push notification tracking
    pushSent: boolean("push_sent").default(false).notNull(),
    pushSentAt: timestamp("push_sent_at", { withTimezone: true }),
    pushError: text("push_error"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
    index("notifications_user_read_idx").on(table.userId, table.isRead),
    index("notifications_org_idx").on(table.organizationId),
    index("notifications_created_idx").on(table.createdAt),
    index("notifications_type_idx").on(table.type),
  ]
);

/**
 * PUSH TOKENS TABLE
 *
 * Stores Expo push tokens for mobile devices
 * Supports multiple devices per user
 */
export const pushTokens = pgTable(
  "push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Expo push token (format: ExponentPushToken[xxx])
    token: text("token").notNull(),

    // Device info for multi-device support
    deviceId: varchar("device_id", { length: 255 }),
    platform: varchar("platform", { length: 20 }), // "ios" | "android"
    appVersion: varchar("app_version", { length: 50 }),

    // Token status
    isActive: boolean("is_active").default(true).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

    // Error tracking for expired/invalid tokens
    failureCount: integer("failure_count").default(0).notNull(),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    lastFailureReason: text("last_failure_reason"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("push_tokens_user_idx").on(table.userId),
    index("push_tokens_token_idx").on(table.token),
    index("push_tokens_active_idx").on(table.userId, table.isActive),
  ]
);

/**
 * SCHEDULED NOTIFICATIONS TABLE
 *
 * Tracks scheduled notifications for idempotency
 * Prevents duplicate notifications from being sent
 */
export const scheduledNotifications = pgTable(
  "scheduled_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // What type of notification is scheduled
    type: varchar("type", { length: 50 }).notNull(), // "clock_in_15min", "clock_in_5min", etc.

    // Target
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Reference to schedule slot
    scheduleSlotId: uuid("schedule_slot_id"),

    // Scheduled time for this notification
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),

    // Execution status
    status: scheduledNotificationStatusEnum("status").default("pending").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),

    // Why it was skipped (e.g., "already_clocked_in", "user_inactive")
    skipReason: text("skip_reason"),

    // Reference to created notification (if sent)
    notificationId: uuid("notification_id"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("scheduled_notifications_user_idx").on(table.userId),
    index("scheduled_notifications_scheduled_for_idx").on(table.scheduledFor),
    index("scheduled_notifications_status_idx").on(table.status),
    index("scheduled_notifications_type_time_idx").on(
      table.userId,
      table.type,
      table.scheduledFor
    ),
  ]
);

// Relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [notifications.organizationId],
    references: [organizations.id],
  }),
}));

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, {
    fields: [pushTokens.userId],
    references: [users.id],
  }),
}));

export const scheduledNotificationsRelations = relations(
  scheduledNotifications,
  ({ one }) => ({
    user: one(users, {
      fields: [scheduledNotifications.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [scheduledNotifications.organizationId],
      references: [organizations.id],
    }),
    notification: one(notifications, {
      fields: [scheduledNotifications.notificationId],
      references: [notifications.id],
    }),
  })
);

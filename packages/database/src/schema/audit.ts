import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  inet,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditActionEnum } from "./enums";
import { organizations } from "./organizations";
import { users } from "./users";

/**
 * AUDIT LOG
 *
 * Immutable audit trail for all significant actions.
 * Critical for compliance and debugging.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Who
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    userEmail: varchar("user_email", { length: 255 }), // Preserved even if user deleted
    userRole: varchar("user_role", { length: 50 }),

    // What
    action: auditActionEnum("action").notNull(),
    resourceType: varchar("resource_type", { length: 100 }).notNull(), // e.g., "shift", "user", "organization"
    resourceId: uuid("resource_id"),

    // Details
    description: text("description"),
    previousValue: jsonb("previous_value"),
    newValue: jsonb("new_value"),
    metadata: jsonb("metadata").$type<{
      ipAddress?: string;
      userAgent?: string;
      platform?: string;
      appVersion?: string;
      requestId?: string;
    }>(),

    // Request context
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),

    // When - immutable
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_org_idx").on(table.organizationId),
    index("audit_user_idx").on(table.userId),
    index("audit_action_idx").on(table.action),
    index("audit_resource_idx").on(table.resourceType, table.resourceId),
    index("audit_created_idx").on(table.createdAt),
    // For compliance queries
    index("audit_org_created_idx").on(table.organizationId, table.createdAt),
  ]
);

/**
 * OFFLINE SYNC QUEUE
 *
 * Stores clock-in/out events that happened while offline.
 * Processed when connection is restored.
 */
export const offlineSyncQueue = pgTable(
  "offline_sync_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Event details
    eventType: varchar("event_type", { length: 50 }).notNull(), // "clock_in" | "clock_out"
    eventData: jsonb("event_data").notNull(),

    // Client timestamp (when it actually happened)
    clientTimestamp: timestamp("client_timestamp", {
      withTimezone: true,
    }).notNull(),

    // Processing status
    status: varchar("status", { length: 20 }).default("pending"), // "pending" | "processed" | "failed" | "conflict"
    processedAt: timestamp("processed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    retryCount: varchar("retry_count", { length: 10 }).default("0"),

    // Device info for debugging
    deviceInfo: jsonb("device_info"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sync_queue_user_idx").on(table.userId),
    index("sync_queue_status_idx").on(table.status),
    index("sync_queue_org_status_idx").on(table.organizationId, table.status),
  ]
);

// Relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const offlineSyncQueueRelations = relations(
  offlineSyncQueue,
  ({ one }) => ({
    user: one(users, {
      fields: [offlineSyncQueue.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [offlineSyncQueue.organizationId],
      references: [organizations.id],
    }),
  })
);

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  time,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { dayOfWeekEnum } from "./enums";
import { organizations } from "./organizations";
import { users } from "./users";
import { teams } from "./teams";

/**
 * SCHEDULE TEMPLATES TABLE
 *
 * Defines recurring schedule patterns that can be assigned to teams or individuals
 * Each template contains multiple slots (time periods) for different days
 */
export const scheduleTemplates = pgTable(
  "schedule_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    // Color for visual identification in UI (hex)
    color: varchar("color", { length: 7 }).default("#6366F1"),

    // Status
    isActive: boolean("is_active").default(true).notNull(),

    // Created by user
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("schedule_templates_org_idx").on(table.organizationId),
    index("schedule_templates_active_idx").on(
      table.organizationId,
      table.isActive
    ),
  ]
);

/**
 * SCHEDULE SLOTS TABLE
 *
 * Individual time slots within a template
 * Supports day and night shifts (including midnight crossings)
 *
 * Example: Night shift 6 PM Monday - 4 AM Tuesday
 * {
 *   dayOfWeek: "monday",
 *   startTime: "18:00",
 *   endTime: "04:00",
 *   crossesMidnight: true
 * }
 */
export const scheduleSlots = pgTable(
  "schedule_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    templateId: uuid("template_id")
      .notNull()
      .references(() => scheduleTemplates.id, { onDelete: "cascade" }),

    // Day of week this slot applies to
    dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),

    // Start time in HH:MM format (24-hour)
    startTime: time("start_time").notNull(),

    // End time - can be next day for night shifts
    endTime: time("end_time").notNull(),

    // If true, end time is on the next day (for night shifts crossing midnight)
    crossesMidnight: boolean("crosses_midnight").default(false).notNull(),

    // Break duration in minutes (for reference/planning)
    breakMinutes: integer("break_minutes").default(0).notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("schedule_slots_template_idx").on(table.templateId),
    index("schedule_slots_day_idx").on(table.templateId, table.dayOfWeek),
  ]
);

/**
 * SCHEDULE ASSIGNMENTS TABLE
 *
 * Links templates to teams or individual users
 * Either teamId OR userId should be set, not both
 *
 * Individual assignments take precedence over team assignments
 */
export const scheduleAssignments = pgTable(
  "schedule_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    templateId: uuid("template_id")
      .notNull()
      .references(() => scheduleTemplates.id, { onDelete: "cascade" }),

    // Either teamId OR userId should be set
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),

    // Effective date range (null means indefinite)
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),

    // Status
    isActive: boolean("is_active").default(true).notNull(),

    // Created by user
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("schedule_assignments_template_idx").on(table.templateId),
    index("schedule_assignments_team_idx").on(table.teamId),
    index("schedule_assignments_user_idx").on(table.userId),
    index("schedule_assignments_active_idx").on(
      table.templateId,
      table.isActive
    ),
  ]
);

// Relations
export const scheduleTemplatesRelations = relations(
  scheduleTemplates,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [scheduleTemplates.organizationId],
      references: [organizations.id],
    }),
    createdByUser: one(users, {
      fields: [scheduleTemplates.createdBy],
      references: [users.id],
    }),
    slots: many(scheduleSlots),
    assignments: many(scheduleAssignments),
  })
);

export const scheduleSlotsRelations = relations(scheduleSlots, ({ one }) => ({
  template: one(scheduleTemplates, {
    fields: [scheduleSlots.templateId],
    references: [scheduleTemplates.id],
  }),
}));

export const scheduleAssignmentsRelations = relations(
  scheduleAssignments,
  ({ one }) => ({
    template: one(scheduleTemplates, {
      fields: [scheduleAssignments.templateId],
      references: [scheduleTemplates.id],
    }),
    team: one(teams, {
      fields: [scheduleAssignments.teamId],
      references: [teams.id],
    }),
    user: one(users, {
      fields: [scheduleAssignments.userId],
      references: [users.id],
    }),
    createdByUser: one(users, {
      fields: [scheduleAssignments.createdBy],
      references: [users.id],
    }),
  })
);

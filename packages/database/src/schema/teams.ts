import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { teamRoleEnum } from "./enums";
import { organizations } from "./organizations";
import { users } from "./users";

/**
 * TEAMS TABLE
 *
 * Groups of employees within an organization
 * Used for schedule assignments and team management
 */
export const teams = pgTable(
  "teams",
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

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("teams_org_idx").on(table.organizationId),
    index("teams_active_idx").on(table.organizationId, table.isActive),
  ]
);

/**
 * TEAM MEMBERS TABLE
 *
 * Many-to-many relationship between teams and users
 * Users can belong to multiple teams
 */
export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Team-specific role
    role: teamRoleEnum("role").default("member").notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("team_members_team_idx").on(table.teamId),
    index("team_members_user_idx").on(table.userId),
    // Ensure a user can only be in a team once
    uniqueIndex("team_members_unique_idx").on(table.teamId, table.userId),
  ]
);

// Relations
export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  shiftStatusEnum,
  locationStatusEnum,
  requestStatusEnum,
} from "./enums";
import { organizations, orgLocations } from "./organizations";
import { users } from "./users";

// Location data captured at clock in/out
export type CapturedLocation = {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: string; // ISO string
  provider?: "gps" | "network" | "fused";
};

// Server verification result
export type ServerVerification = {
  verified: boolean;
  distanceFromTarget: number; // meters
  targetLocationId: string;
  verifiedAt: string;
  flags: string[]; // e.g., ["high_accuracy", "within_threshold"]
};

/**
 * SHIFTS TABLE
 *
 * Core time tracking table. Implements the "Shift Linkage" algorithm:
 * - When clocking in, creates a new shift with status "open"
 * - When clocking out, finds the most recent OPEN shift for the user
 * - Duration is calculated across midnight boundaries
 * - Shifts open >16 hours are marked "stale"
 */
export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Tenant isolation
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => orgLocations.id),

    // Status tracking
    status: shiftStatusEnum("status").default("open").notNull(),

    // Clock in data - ALL times in UTC
    clockInAt: timestamp("clock_in_at", { withTimezone: true }).notNull(),
    clockInLocation: jsonb("clock_in_location").$type<CapturedLocation>(),
    clockInLocationStatus: locationStatusEnum(
      "clock_in_location_status"
    ).default("unknown"),
    clockInServerVerification: jsonb(
      "clock_in_server_verification"
    ).$type<ServerVerification>(),
    clockInDeviceInfo: jsonb("clock_in_device_info").$type<{
      platform: string;
      appVersion: string;
      deviceId: string;
    }>(),

    // Clock out data
    clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
    clockOutLocation: jsonb("clock_out_location").$type<CapturedLocation>(),
    clockOutLocationStatus: locationStatusEnum("clock_out_location_status"),
    clockOutServerVerification: jsonb(
      "clock_out_server_verification"
    ).$type<ServerVerification>(),
    clockOutDeviceInfo: jsonb("clock_out_device_info").$type<{
      platform: string;
      appVersion: string;
      deviceId: string;
    }>(),

    // Calculated fields (computed on clock out)
    durationMinutes: integer("duration_minutes"),
    breakMinutes: integer("break_minutes").default(0),
    netDurationMinutes: integer("net_duration_minutes"),

    // For midnight-crossing shifts, track the "attributed date"
    // This is the START date of the shift for reporting
    shiftDate: timestamp("shift_date", { withTimezone: true }).notNull(),

    // Notes
    clockInNote: text("clock_in_note"),
    clockOutNote: text("clock_out_note"),
    managerNote: text("manager_note"),

    // Revision tracking (for "forgot to clock out" flow)
    isRevised: boolean("is_revised").default(false),
    originalClockOutAt: timestamp("original_clock_out_at", {
      withTimezone: true,
    }),
    revisedBy: uuid("revised_by"),
    revisedAt: timestamp("revised_at", { withTimezone: true }),
    revisionReason: text("revision_reason"),

    // Stale shift tracking
    markedStaleAt: timestamp("marked_stale_at", { withTimezone: true }),
    staleResolutionNote: text("stale_resolution_note"),

    // Flags
    wasOffline: boolean("was_offline").default(false),
    syncedAt: timestamp("synced_at", { withTimezone: true }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("shifts_org_id_idx").on(table.organizationId),
    index("shifts_user_id_idx").on(table.userId),
    index("shifts_status_idx").on(table.status),
    index("shifts_clock_in_idx").on(table.clockInAt),
    index("shifts_shift_date_idx").on(table.shiftDate),
    // Composite index for the shift linkage query
    index("shifts_user_status_idx").on(table.userId, table.status),
    // For reporting queries
    index("shifts_org_date_idx").on(table.organizationId, table.shiftDate),
  ]
);

/**
 * CHECK-IN REQUESTS
 *
 * Created when an employee tries to clock in/out while out of geofence range.
 * Managers can approve or deny these requests.
 */
export const checkInRequests = pgTable(
  "check_in_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Links
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id").references(() => shifts.id, {
      onDelete: "set null",
    }),

    // Request type
    requestType: varchar("request_type", { length: 20 }).notNull(), // "clock_in" | "clock_out"

    // Status
    status: requestStatusEnum("status").default("pending").notNull(),

    // Location at request time
    requestedLocation: jsonb("requested_location")
      .$type<CapturedLocation>()
      .notNull(),
    distanceFromGeofence: integer("distance_from_geofence"), // meters from nearest valid location

    // User's reason for out-of-range clock in
    reason: text("reason").notNull(),

    // Requested timestamp (user might be requesting a past time)
    requestedTimestamp: timestamp("requested_timestamp", {
      withTimezone: true,
    }).notNull(),

    // Manager response
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewerNote: text("reviewer_note"),
    denialReason: text("denial_reason"),

    // Auto-expiration
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("requests_org_idx").on(table.organizationId),
    index("requests_user_idx").on(table.userId),
    index("requests_status_idx").on(table.status),
    // For manager dashboard - pending requests
    index("requests_org_status_idx").on(table.organizationId, table.status),
  ]
);

/**
 * BREAKS
 *
 * Optional break tracking within shifts.
 */
export const breaks = pgTable(
  "breaks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),

    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes"),

    breakType: varchar("break_type", { length: 50 }).default("unpaid"), // "paid" | "unpaid" | "meal"

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("breaks_shift_idx").on(table.shiftId)]
);

// Relations
export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [shifts.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [shifts.userId],
    references: [users.id],
  }),
  location: one(orgLocations, {
    fields: [shifts.locationId],
    references: [orgLocations.id],
  }),
  revisedByUser: one(users, {
    fields: [shifts.revisedBy],
    references: [users.id],
  }),
  breaks: many(breaks),
  requests: many(checkInRequests),
}));

export const checkInRequestsRelations = relations(
  checkInRequests,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [checkInRequests.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [checkInRequests.userId],
      references: [users.id],
    }),
    shift: one(shifts, {
      fields: [checkInRequests.shiftId],
      references: [shifts.id],
    }),
    reviewer: one(users, {
      fields: [checkInRequests.reviewedBy],
      references: [users.id],
    }),
  })
);

export const breaksRelations = relations(breaks, ({ one }) => ({
  shift: one(shifts, {
    fields: [breaks.shiftId],
    references: [shifts.id],
  }),
}));

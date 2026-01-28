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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { subscriptionTierEnum } from "./enums";

// Geofence settings type for JSON column
export type GeofenceSettings = {
  enabled: boolean;
  radiusMeters: number;
  strictMode: boolean; // If true, no out-of-range requests allowed
  requireServerVerification: boolean;
};

// Organization timezone and locale settings
export type OrgLocaleSettings = {
  timezone: string; // IANA timezone (e.g., "America/New_York")
  dateFormat: string; // e.g., "MM/DD/YYYY"
  timeFormat: "12h" | "24h";
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  language: string; // e.g., "en-US"
};

// Shift policy settings
export type ShiftPolicySettings = {
  maxShiftHours: number; // Default 16, marks as stale after this
  minShiftMinutes: number; // Minimum valid shift duration
  autoBreakDeductionMinutes: number; // Auto-deduct break for shifts > X hours
  autoBreakThresholdHours: number;
  overtimeThresholdHours: number; // Weekly hours before overtime
  requireBreakClockOut: boolean;
};

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Basic info
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  logoUrl: varchar("logo_url", { length: 500 }),

  // Contact
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  website: varchar("website", { length: 255 }),

  // Address
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),

  // Location for geofencing - primary coordinates
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),

  // Settings (JSONB for flexibility)
  geofenceSettings: jsonb("geofence_settings")
    .$type<GeofenceSettings>()
    .default({
      enabled: true,
      radiusMeters: 200,
      strictMode: false,
      requireServerVerification: true,
    }),
  localeSettings: jsonb("locale_settings").$type<OrgLocaleSettings>().default({
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
    weekStartsOn: 0,
    language: "en-US",
  }),
  shiftPolicySettings: jsonb("shift_policy_settings")
    .$type<ShiftPolicySettings>()
    .default({
      maxShiftHours: 16,
      minShiftMinutes: 5,
      autoBreakDeductionMinutes: 30,
      autoBreakThresholdHours: 6,
      overtimeThresholdHours: 40,
      requireBreakClockOut: false,
    }),

  // Subscription
  subscriptionTier: subscriptionTierEnum("subscription_tier").default("free"),
  maxEmployees: integer("max_employees").default(10),

  // Status
  isActive: boolean("is_active").default(true),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Multiple locations per organization (for enterprises)
export const orgLocations = pgTable("org_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  radiusMeters: integer("radius_meters").default(200),

  isActive: boolean("is_active").default(true),
  isPrimary: boolean("is_primary").default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  locations: many(orgLocations),
}));

export const orgLocationsRelations = relations(orgLocations, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgLocations.organizationId],
    references: [organizations.id],
  }),
}));

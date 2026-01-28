import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { userRoleEnum, otpStatusEnum } from "./enums";
import { organizations } from "./organizations";

// User preferences stored as JSON
export type UserPreferences = {
  notifications: {
    shiftReminders: boolean;
    requestUpdates: boolean;
    weeklyReports: boolean;
  };
  display: {
    theme: "light" | "dark" | "system";
    compactMode: boolean;
  };
  biometricEnabled: boolean;
  lastBiometricPrompt: string | null;
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Organization link (null for super_admin)
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),

    // Role
    role: userRoleEnum("role").notNull().default("employee"),

    // Profile - required fields per spec
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    position: varchar("position", { length: 100 }),
    registrationNumber: varchar("registration_number", { length: 100 }),
    avatarUrl: varchar("avatar_url", { length: 500 }),

    // Contact
    email: varchar("email", { length: 255 }).unique(),
    phone: varchar("phone", { length: 50 }).unique(),
    phoneVerified: boolean("phone_verified").default(false),
    emailVerified: boolean("email_verified").default(false),

    // Auth - for web (Better Auth handles this mostly)
    passwordHash: text("password_hash"),

    // Mobile-specific auth
    biometricPublicKey: text("biometric_public_key"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),

    // Preferences
    preferences: jsonb("preferences")
      .$type<UserPreferences>()
      .default({
        notifications: {
          shiftReminders: true,
          requestUpdates: true,
          weeklyReports: true,
        },
        display: {
          theme: "system",
          compactMode: false,
        },
        biometricEnabled: false,
        lastBiometricPrompt: null,
      }),

    // Status
    isActive: boolean("is_active").default(true),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    invitedBy: uuid("invited_by"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("users_org_id_idx").on(table.organizationId),
    index("users_email_idx").on(table.email),
    index("users_phone_idx").on(table.phone),
    index("users_role_idx").on(table.role),
  ]
);

// OTP verification table for mobile auth
export const otpVerifications = pgTable(
  "otp_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: varchar("phone", { length: 50 }).notNull(),
    code: varchar("code", { length: 6 }).notNull(),
    status: otpStatusEnum("status").default("pending"),
    attempts: varchar("attempts", { length: 10 }).default("0"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("otp_phone_idx").on(table.phone),
    index("otp_status_idx").on(table.status),
  ]
);

// Refresh tokens for mobile JWT auth
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    deviceInfo: jsonb("device_info").$type<{
      platform: string;
      deviceId: string;
      appVersion: string;
    }>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("refresh_tokens_user_idx").on(table.userId),
    index("refresh_tokens_token_idx").on(table.token),
  ]
);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  inviter: one(users, {
    fields: [users.invitedBy],
    references: [users.id],
  }),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

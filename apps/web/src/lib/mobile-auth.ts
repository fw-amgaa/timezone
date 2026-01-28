/**
 * Mobile Authentication Utilities
 *
 * JWT-based authentication for mobile app with refresh token support.
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db, eq, and, gt } from "@timezone/database";
import { users, refreshTokens } from "@timezone/database/schema";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const VERIFICATION_TOKEN_EXPIRY = "10m";

interface TokenPayload {
  userId: string;
  type: "access" | "verification";
  phone?: string;
}

interface DeviceInfo {
  platform: string;
  deviceId: string;
  appVersion: string;
}

interface MobileSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Create access and refresh tokens for mobile session
 */
export async function createMobileSession(
  userId: string,
  deviceInfo?: DeviceInfo
): Promise<MobileSession> {
  // Create access token (JWT)
  const accessToken = jwt.sign({ userId, type: "access" }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  // Create refresh token (random string stored in DB)
  const refreshToken = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  // Store refresh token in database
  await db.insert(refreshTokens).values({
    userId,
    token: refreshToken,
    deviceInfo: deviceInfo || null,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

/**
 * Verify an access token and return the payload
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    if (payload.type !== "access") return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Create a short-lived verification token for password setup
 */
export function createVerificationToken(phone: string): string {
  return jwt.sign({ phone, type: "verification" }, JWT_SECRET, {
    expiresIn: VERIFICATION_TOKEN_EXPIRY,
  });
}

/**
 * Verify a verification token and return the phone number
 */
export function verifyVerificationToken(
  token: string
): { phone: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    if (payload.type !== "verification" || !payload.phone) return null;
    return { phone: payload.phone };
  } catch {
    return null;
  }
}

/**
 * Validate refresh token and return user ID if valid
 */
export async function validateRefreshToken(
  token: string
): Promise<{ userId: string; tokenId: string } | null> {
  const storedToken = await db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.token, token),
      gt(refreshTokens.expiresAt, new Date())
    ),
  });

  if (!storedToken) return null;

  // Update last used timestamp
  await db
    .update(refreshTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(refreshTokens.id, storedToken.id));

  return { userId: storedToken.userId, tokenId: storedToken.id };
}

/**
 * Invalidate a refresh token (logout from device)
 */
export async function invalidateRefreshToken(tokenId: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenId));
}

/**
 * Invalidate all refresh tokens for a user (logout from all devices)
 */
export async function invalidateAllRefreshTokens(
  userId: string
): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
}

/**
 * Authenticate a request and return the user
 */
export async function authenticateRequest(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, error: "Missing or invalid authorization header" };
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return { user: null, error: "Invalid or expired token" };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId),
  });

  if (!user) {
    return { user: null, error: "User not found" };
  }

  if (!user.isActive) {
    return { user: null, error: "User account is deactivated" };
  }

  return { user, error: null };
}

/**
 * Sanitize user object for API response (remove sensitive fields)
 */
export function sanitizeUser(user: any) {
  const { passwordHash, biometricPublicKey, preferences, ...safeUser } = user;

  return {
    ...safeUser,
    // Include non-sensitive preferences
    preferences: preferences
      ? {
          notifications: preferences.notifications,
          display: preferences.display,
          biometricEnabled: preferences.biometricEnabled,
        }
      : null,
  };
}

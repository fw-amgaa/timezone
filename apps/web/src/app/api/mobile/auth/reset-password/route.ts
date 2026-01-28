import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db, eq } from "@timezone/database";
import { users } from "@timezone/database/schema";
import {
  verifyVerificationToken,
  createMobileSession,
  sanitizeUser,
} from "@/lib/mobile-auth";

/**
 * POST /api/mobile/auth/reset-password
 *
 * Reset password after OTP verification.
 * Used for forgot password flow.
 */

const schema = z.object({
  verificationToken: z.string().min(1, "Verification token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  deviceInfo: z
    .object({
      platform: z.string().optional(),
      deviceId: z.string().optional(),
      appVersion: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { verificationToken, password, deviceInfo } = schema.parse(body);

    // Verify the verification token
    const tokenData = verifyVerificationToken(verificationToken);

    if (!tokenData) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired verification token. Please verify your phone again.",
        },
        { status: 401 }
      );
    }

    const { phone } = tokenData;

    // Find the user
    const user = await db.query.users.findFirst({
      where: eq(users.phone, phone),
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Account is deactivated" },
        { status: 403 }
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user with new password
    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Create session tokens
    const session = await createMobileSession(user.id, deviceInfo);

    // Update last login
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      success: true,
      message: "Password reset successfully",
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error("Reset password error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db, eq } from "@timezone/database";
import { users } from "@timezone/database/schema";
import { createMobileSession, sanitizeUser } from "@/lib/mobile-auth";

/**
 * POST /api/mobile/auth/login
 *
 * Login with phone number and password.
 * Returns access and refresh tokens on success.
 */

const schema = z.object({
  phone: z.string().min(8, "Phone number is required"),
  password: z.string().min(1, "Password is required"),
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
    const { phone, password, deviceInfo } = schema.parse(body);

    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, "");

    // Find user by phone
    const user = await db.query.users.findFirst({
      where: eq(users.phone, cleanPhone),
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "Account is deactivated. Please contact your administrator.",
        },
        { status: 403 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          error: "Please complete registration first",
          needsRegistration: true,
        },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number or password" },
        { status: 401 }
      );
    }

    // Create session tokens
    const session = await createMobileSession(user.id, deviceInfo as any);

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

    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

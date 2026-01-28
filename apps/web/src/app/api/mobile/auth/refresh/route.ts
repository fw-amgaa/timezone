import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq } from "@timezone/database";
import { users, refreshTokens } from "@timezone/database/schema";
import {
  validateRefreshToken,
  createMobileSession,
  sanitizeUser,
} from "@/lib/mobile-auth";

/**
 * POST /api/mobile/auth/refresh
 *
 * Refresh access token using a valid refresh token.
 * Implements token rotation for security.
 */

const schema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = schema.parse(body);

    // Validate refresh token
    const tokenData = await validateRefreshToken(refreshToken);

    if (!tokenData) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired refresh token" },
        { status: 401 }
      );
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, tokenData.userId),
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      // Invalidate the token since user is deactivated
      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.id, tokenData.tokenId));

      return NextResponse.json(
        { success: false, error: "Account is deactivated" },
        { status: 403 }
      );
    }

    // Get the old token's device info for the new token
    const oldToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.id, tokenData.tokenId),
    });

    // Invalidate old refresh token (token rotation)
    await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenData.tokenId));

    // Create new session tokens
    const session = await createMobileSession(
      user.id,
      oldToken?.deviceInfo as any
    );

    // Update last active
    await db
      .update(users)
      .set({ lastActiveAt: new Date() })
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

    console.error("Refresh token error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

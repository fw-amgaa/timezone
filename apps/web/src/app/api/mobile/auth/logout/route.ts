import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and } from "@timezone/database";
import { refreshTokens } from "@timezone/database/schema";
import { authenticateRequest } from "@/lib/mobile-auth";

/**
 * POST /api/mobile/auth/logout
 *
 * Logout the current user by invalidating their refresh token.
 * Optionally logout from all devices.
 */

const schema = z.object({
  refreshToken: z.string().optional(),
  logoutAll: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const { user, error } = await authenticateRequest(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { refreshToken, logoutAll } = schema.parse(body);

    if (logoutAll) {
      // Invalidate all refresh tokens for this user
      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.userId, user.id));
    } else if (refreshToken) {
      // Invalidate specific refresh token
      await db
        .delete(refreshTokens)
        .where(
          and(
            eq(refreshTokens.token, refreshToken),
            eq(refreshTokens.userId, user.id)
          )
        );
    }

    return NextResponse.json({
      success: true,
      message: logoutAll ? "Logged out from all devices" : "Logged out successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input" },
        { status: 400 }
      );
    }

    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

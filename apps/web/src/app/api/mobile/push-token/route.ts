import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and } from "@timezone/database";
import { pushTokens } from "@timezone/database/schema";
import { authenticateRequest } from "@/lib/mobile-auth";

/**
 * POST /api/mobile/push-token
 *
 * Register or update an Expo push token for the current user.
 */
const registerTokenSchema = z.object({
  token: z.string().min(1, "Push token is required"),
  deviceId: z.string().optional(),
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().optional(),
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
    const data = registerTokenSchema.parse(body);

    const now = new Date();

    // Check if this token already exists for this user
    const existingToken = await db.query.pushTokens.findFirst({
      where: and(
        eq(pushTokens.userId, user.id),
        eq(pushTokens.token, data.token)
      ),
    });

    if (existingToken) {
      // Update existing token
      await db
        .update(pushTokens)
        .set({
          isActive: true,
          deviceId: data.deviceId || existingToken.deviceId,
          platform: data.platform,
          appVersion: data.appVersion || existingToken.appVersion,
          lastUsedAt: now,
          failureCount: 0, // Reset failure count on re-registration
          updatedAt: now,
        })
        .where(eq(pushTokens.id, existingToken.id));

      return NextResponse.json({
        success: true,
        tokenId: existingToken.id,
        message: "Push token updated",
      });
    }

    // If deviceId is provided, check if we have a different token for this device
    // and deactivate it (only one token per device)
    if (data.deviceId) {
      await db
        .update(pushTokens)
        .set({ isActive: false, updatedAt: now })
        .where(
          and(
            eq(pushTokens.userId, user.id),
            eq(pushTokens.deviceId, data.deviceId),
            eq(pushTokens.isActive, true)
          )
        );
    }

    // Create new token
    const [newToken] = await db
      .insert(pushTokens)
      .values({
        userId: user.id,
        token: data.token,
        deviceId: data.deviceId,
        platform: data.platform,
        appVersion: data.appVersion,
        isActive: true,
        lastUsedAt: now,
      })
      .returning();

    return NextResponse.json({
      success: true,
      tokenId: newToken.id,
      message: "Push token registered",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Register push token error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mobile/push-token
 *
 * Remove a push token (on logout or when user disables notifications).
 */
const removeTokenSchema = z.object({
  token: z.string().optional(),
  deviceId: z.string().optional(),
  removeAll: z.boolean().optional(),
});

export async function DELETE(request: NextRequest) {
  const { user, error } = await authenticateRequest(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const data = removeTokenSchema.parse(body);

    if (!data.token && !data.deviceId && !data.removeAll) {
      return NextResponse.json(
        { success: false, error: "Either token, deviceId, or removeAll must be provided" },
        { status: 400 }
      );
    }

    const now = new Date();
    let removedCount = 0;

    if (data.removeAll) {
      // Deactivate all tokens for this user
      const result = await db
        .update(pushTokens)
        .set({ isActive: false, updatedAt: now })
        .where(
          and(eq(pushTokens.userId, user.id), eq(pushTokens.isActive, true))
        )
        .returning({ id: pushTokens.id });
      removedCount = result.length;
    } else if (data.token) {
      // Deactivate specific token
      const result = await db
        .update(pushTokens)
        .set({ isActive: false, updatedAt: now })
        .where(
          and(
            eq(pushTokens.userId, user.id),
            eq(pushTokens.token, data.token),
            eq(pushTokens.isActive, true)
          )
        )
        .returning({ id: pushTokens.id });
      removedCount = result.length;
    } else if (data.deviceId) {
      // Deactivate all tokens for this device
      const result = await db
        .update(pushTokens)
        .set({ isActive: false, updatedAt: now })
        .where(
          and(
            eq(pushTokens.userId, user.id),
            eq(pushTokens.deviceId, data.deviceId),
            eq(pushTokens.isActive, true)
          )
        )
        .returning({ id: pushTokens.id });
      removedCount = result.length;
    }

    return NextResponse.json({
      success: true,
      removedCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Remove push token error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and, desc, sql } from "@timezone/database";
import { notifications } from "@timezone/database/schema";
import { authenticateRequest } from "@/lib/mobile-auth";

/**
 * GET /api/mobile/notifications
 *
 * Get the current user's notifications with pagination and filtering.
 */
export async function GET(request: NextRequest) {
  const { user, error } = await authenticateRequest(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    // Build where conditions
    const whereConditions = [eq(notifications.userId, user.id)];

    if (unreadOnly) {
      whereConditions.push(eq(notifications.isRead, false));
    }

    // Get notifications
    const userNotifications = await db.query.notifications.findMany({
      where: and(...whereConditions),
      orderBy: [desc(notifications.createdAt)],
      limit,
      offset,
    });

    // Get total count and unread count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.userId, user.id));

    const [unreadCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));

    const total = Number(countResult?.count || 0);
    const unreadCount = Number(unreadCountResult?.count || 0);

    return NextResponse.json({
      success: true,
      notifications: userNotifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/mobile/notifications
 *
 * Mark notifications as read.
 */
const markReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).optional(),
  markAllRead: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const { user, error } = await authenticateRequest(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const data = markReadSchema.parse(body);

    if (!data.notificationIds && !data.markAllRead) {
      return NextResponse.json(
        { success: false, error: "Either notificationIds or markAllRead must be provided" },
        { status: 400 }
      );
    }

    const now = new Date();
    let markedCount = 0;

    if (data.markAllRead) {
      // Mark all unread notifications as read
      const result = await db
        .update(notifications)
        .set({ isRead: true, readAt: now })
        .where(
          and(
            eq(notifications.userId, user.id),
            eq(notifications.isRead, false)
          )
        );
      markedCount = result.rowCount || 0;
    } else if (data.notificationIds && data.notificationIds.length > 0) {
      // Mark specific notifications as read
      for (const notificationId of data.notificationIds) {
        const result = await db
          .update(notifications)
          .set({ isRead: true, readAt: now })
          .where(
            and(
              eq(notifications.id, notificationId),
              eq(notifications.userId, user.id),
              eq(notifications.isRead, false)
            )
          );
        if (result.rowCount && result.rowCount > 0) {
          markedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      markedCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Mark notifications read error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

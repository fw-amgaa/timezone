/**
 * Expo Push Notification sender service
 */

import { db, eq, and, inArray } from "@timezone/database";
import {
  notifications,
  pushTokens,
  NotificationData,
  NotificationType,
} from "@timezone/database/schema";

interface ExpoPushMessage {
  to: string;
  sound?: "default" | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  ttl?: number;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: "DeviceNotRegistered" | "MessageTooBig" | "MessageRateExceeded" | "InvalidCredentials";
  };
}

interface ExpoPushReceipt {
  status: "ok" | "error";
  message?: string;
  details?: {
    error?: string;
  };
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Send push notifications via Expo's push service
 */
async function sendExpoNotifications(
  messages: ExpoPushMessage[]
): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return [];

  // Expo accepts batches of up to 100 messages
  const batches: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    batches.push(messages.slice(i, i + 100));
  }

  const allTickets: ExpoPushTicket[] = [];

  for (const batch of batches) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(batch),
      });

      const result = await response.json();
      const tickets = result.data as ExpoPushTicket[];
      allTickets.push(...tickets);
    } catch (error) {
      console.error("Error sending push notifications:", error);
      // Return error tickets for this batch
      allTickets.push(
        ...batch.map(() => ({
          status: "error" as const,
          message: "Failed to send",
        }))
      );
    }
  }

  return allTickets;
}

/**
 * Mark invalid tokens as inactive
 */
async function handleInvalidTokens(
  tokenIds: string[],
  error: string
): Promise<void> {
  if (tokenIds.length === 0) return;

  await db
    .update(pushTokens)
    .set({
      isActive: false,
      failureCount: 1,
      lastFailureAt: new Date(),
      updatedAt: new Date(),
    })
    .where(inArray(pushTokens.id, tokenIds));

  console.log(`Marked ${tokenIds.length} tokens as inactive: ${error}`);
}

/**
 * Increment failure count for tokens
 */
async function incrementFailureCount(tokenIds: string[]): Promise<void> {
  if (tokenIds.length === 0) return;

  for (const tokenId of tokenIds) {
    const token = await db.query.pushTokens.findFirst({
      where: eq(pushTokens.id, tokenId),
    });

    if (token) {
      const newFailureCount = (token.failureCount || 0) + 1;
      const shouldDeactivate = newFailureCount >= 3;

      await db
        .update(pushTokens)
        .set({
          failureCount: newFailureCount,
          lastFailureAt: new Date(),
          isActive: shouldDeactivate ? false : token.isActive,
          updatedAt: new Date(),
        })
        .where(eq(pushTokens.id, tokenId));
    }
  }
}

/**
 * Get channel ID based on notification type
 */
function getChannelId(type: NotificationType): string {
  switch (type) {
    case "clock_in_reminder":
    case "clock_out_reminder":
    case "manager_alert":
      return "schedule-reminders";
    case "request_approved":
    case "request_denied":
      return "request-updates";
    case "schedule_update":
      return "schedule-updates";
    case "weekly_summary":
      return "weekly-summaries";
    case "app_update":
      return "general";
    default:
      return "general";
  }
}

/**
 * Create a notification record and send push notification
 */
export async function sendNotification(params: {
  userId: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
}): Promise<{ notificationId: string; pushSent: boolean; error?: string }> {
  const { userId, organizationId, type, title, message, data } = params;

  // Create notification record first
  const [notification] = await db
    .insert(notifications)
    .values({
      userId,
      organizationId,
      type,
      title,
      message,
      data: data || null,
      isRead: false,
      pushSent: false,
    })
    .returning();

  // Get active push tokens for user
  const tokens = await db.query.pushTokens.findMany({
    where: and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true)),
  });

  if (tokens.length === 0) {
    return { notificationId: notification.id, pushSent: false };
  }

  // Build push messages
  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    sound: "default",
    title,
    body: message,
    data: {
      notificationId: notification.id,
      type,
      ...data,
    },
    channelId: getChannelId(type),
    priority: type === "manager_alert" ? "high" : "default",
  }));

  // Send push notifications
  const tickets = await sendExpoNotifications(messages);

  // Process results
  const invalidTokenIds: string[] = [];
  const failedTokenIds: string[] = [];
  let pushSent = false;
  let pushError: string | undefined;

  tickets.forEach((ticket, index) => {
    if (ticket.status === "ok") {
      pushSent = true;
    } else {
      const tokenId = tokens[index].id;
      if (ticket.details?.error === "DeviceNotRegistered") {
        invalidTokenIds.push(tokenId);
      } else {
        failedTokenIds.push(tokenId);
        pushError = ticket.message || ticket.details?.error;
      }
    }
  });

  // Handle invalid tokens
  await handleInvalidTokens(invalidTokenIds, "DeviceNotRegistered");
  await incrementFailureCount(failedTokenIds);

  // Update notification with push status
  await db
    .update(notifications)
    .set({
      pushSent,
      pushSentAt: pushSent ? new Date() : null,
      pushError: pushError || null,
    })
    .where(eq(notifications.id, notification.id));

  return { notificationId: notification.id, pushSent, error: pushError };
}

/**
 * Send batch notifications to multiple users
 */
export async function sendBatchNotifications(
  notificationParams: Array<{
    userId: string;
    organizationId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: NotificationData;
  }>
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // Process in smaller batches to avoid overwhelming the system
  const batchSize = 50;
  for (let i = 0; i < notificationParams.length; i += batchSize) {
    const batch = notificationParams.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((params) => sendNotification(params))
    );

    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value.pushSent) {
        sent++;
      } else {
        failed++;
      }
    });
  }

  return { sent, failed };
}

/**
 * Send notification to all employees in an organization
 */
export async function sendOrgWideNotification(params: {
  organizationId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
  excludeUserIds?: string[];
}): Promise<{ sent: number; failed: number }> {
  const { organizationId, excludeUserIds = [], ...notificationData } = params;

  // Get all active users in the organization
  const { users } = await import("@timezone/database/schema");
  const orgUsers = await db.query.users.findMany({
    where: and(
      eq(users.organizationId, organizationId),
      eq(users.isActive, true)
    ),
    columns: { id: true },
  });

  const userIds = orgUsers
    .map((u) => u.id)
    .filter((id) => !excludeUserIds.includes(id));

  const notificationParams = userIds.map((userId) => ({
    userId,
    organizationId,
    ...notificationData,
  }));

  return sendBatchNotifications(notificationParams);
}

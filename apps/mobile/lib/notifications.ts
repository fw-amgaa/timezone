/**
 * Push Notifications Library
 * Handles Expo push notification setup, registration, and listeners
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and register push token with backend
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  try {
    // Check existing permission status
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission not granted");
      return null;
    }

    // Get the Expo push token
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.log("No project ID found for push notifications");
      // Return early in development, but continue in production
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;
    console.log("Expo push token:", token);

    // Register token with backend
    const response = await api.registerPushToken({
      token,
      platform: Platform.OS as "ios" | "android",
      deviceId: Device.modelId || undefined,
      appVersion: Constants.expoConfig?.version || undefined,
    });

    if (response.success) {
      console.log("Push token registered with backend");
    } else {
      console.log("Failed to register push token:", response.error);
    }

    // Configure Android notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6366F1",
      });

      // Create channel for shift reminders
      await Notifications.setNotificationChannelAsync("shift-reminders", {
        name: "Shift Reminders",
        description: "Reminders for upcoming shifts and clock-in/out",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6366F1",
      });

      // Create channel for request updates
      await Notifications.setNotificationChannelAsync("request-updates", {
        name: "Request Updates",
        description: "Updates on your check-in request status",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6366F1",
      });
    }

    return token;
  } catch (error) {
    console.error("Error registering for push notifications:", error);
    return null;
  }
}

/**
 * Remove push token from backend (call on logout)
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    await api.removePushToken({ removeAll: true });
    console.log("Push tokens removed from backend");
  } catch (error) {
    console.error("Error removing push token:", error);
  }
}

/**
 * Hook to handle notification listeners and navigation
 */
export function useNotificationListeners() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Handle notifications received while app is foregrounded
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification);
        // Could trigger a refresh of notification count here
      });

    // Handle notification taps (opens app from notification)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification tapped:", response);

        const data = response.notification.request.content.data as {
          type?: string;
          requestId?: string;
          shiftId?: string;
          scheduleId?: string;
          actionUrl?: string;
        };

        // Navigate based on notification type/data
        if (data.actionUrl) {
          router.push(data.actionUrl as any);
        } else if (data.requestId) {
          // Navigate to request details or history
          router.push("/notifications");
        } else if (data.shiftId) {
          // Navigate to history
          router.push("/(tabs)/history");
        } else if (data.scheduleId) {
          // Navigate to schedule view (calendar)
          router.push("/calendar");
        } else {
          // Default: open notifications screen
          router.push("/notifications");
        }
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);
}

/**
 * Hook to get the current unread notification count
 */
export function useUnreadNotificationCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.getNotifications({ limit: 1, unreadOnly: true });
      if (response.success) {
        setUnreadCount(response.unreadCount);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
  }, []);

  return { unreadCount, loading, refetch: fetchUnreadCount };
}

/**
 * Schedule a local notification (for testing or offline mode)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  trigger?: Notifications.NotificationTriggerInput
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: "default",
    },
    trigger: trigger || null, // null = immediate
  });
}

/**
 * Get pending scheduled notifications
 */
export async function getPendingNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Cancel all pending notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Set badge count (iOS)
 */
export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}

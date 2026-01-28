import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";

// Storage keys
const OFFLINE_QUEUE_KEY = "@timezone/offline_queue";
const LAST_SYNC_KEY = "@timezone/last_sync";

// Types for offline events
export type OfflineEventType = "clock_in" | "clock_out" | "request_submit";

export interface OfflineEvent {
  id: string;
  type: OfflineEventType;
  timestamp: string;
  data: {
    userId: string;
    organizationId: string;
    location?: {
      latitude: number;
      longitude: number;
      accuracy: number;
      timestamp?: number;
    };
    deviceInfo?: {
      platform: string;
      appVersion: string;
      deviceId: string;
    };
    note?: string;
    reason?: string;
  };
  retryCount: number;
  createdAt: string;
}

export interface SyncResult {
  success: boolean;
  synced: string[];
  failed: string[];
  errors: Array<{ id: string; error: string }>;
}

/**
 * OFFLINE SYNC SYSTEM
 *
 * When the device is offline, clock-in/out events are queued locally.
 * When connectivity returns, the queue is processed in order.
 *
 * Key features:
 * - FIFO processing (maintains chronological order)
 * - Retry with exponential backoff
 * - Conflict detection (e.g., server already has newer data)
 * - Automatic sync on network change
 */

/**
 * Generate a unique ID for offline events
 */
export function generateOfflineId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if the device is currently online
 */
export async function isOnline(): Promise<boolean> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected === true && networkState.isInternetReachable === true;
  } catch {
    return false;
  }
}

/**
 * Add an event to the offline queue
 */
export async function queueOfflineEvent(event: Omit<OfflineEvent, "id" | "createdAt" | "retryCount">): Promise<string> {
  try {
    const queue = await getOfflineQueue();

    const newEvent: OfflineEvent = {
      ...event,
      id: generateOfflineId(),
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    queue.push(newEvent);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

    console.log(`[OfflineSync] Queued event: ${newEvent.type} (${newEvent.id})`);

    return newEvent.id;
  } catch (error) {
    console.error("[OfflineSync] Failed to queue event:", error);
    throw error;
  }
}

/**
 * Get all events in the offline queue
 */
export async function getOfflineQueue(): Promise<OfflineEvent[]> {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("[OfflineSync] Failed to get queue:", error);
    return [];
  }
}

/**
 * Get the count of pending offline events
 */
export async function getQueueCount(): Promise<number> {
  const queue = await getOfflineQueue();
  return queue.length;
}

/**
 * Remove a specific event from the queue
 */
async function removeFromQueue(eventId: string): Promise<void> {
  const queue = await getOfflineQueue();
  const filtered = queue.filter((e) => e.id !== eventId);
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
}

/**
 * Update retry count for a failed event
 */
async function incrementRetryCount(eventId: string): Promise<void> {
  const queue = await getOfflineQueue();
  const updated = queue.map((e) => {
    if (e.id === eventId) {
      return { ...e, retryCount: e.retryCount + 1 };
    }
    return e;
  });
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
}

/**
 * Process a single offline event
 */
async function processEvent(event: OfflineEvent, baseUrl: string): Promise<{ success: boolean; error?: string }> {
  let endpoint: string;
  let method = "POST";

  switch (event.type) {
    case "clock_in":
      endpoint = "/api/shifts/clock-in";
      break;
    case "clock_out":
      endpoint = "/api/shifts/clock-out";
      break;
    case "request_submit":
      endpoint = "/api/requests";
      break;
    default:
      return { success: false, error: `Unknown event type: ${event.type}` };
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        // TODO: Add auth token
      },
      body: JSON.stringify({
        ...event.data,
        _offlineEventId: event.id,
        _offlineTimestamp: event.timestamp,
        _wasOffline: true,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      if (result.error === "double_clock_in") {
        // This is a conflict - the user already clocked in on another device
        return { success: false, error: "conflict:already_clocked_in" };
      }
      if (result.error === "no_open_shift") {
        // No shift to clock out of
        return { success: false, error: "conflict:no_open_shift" };
      }
      return { success: false, error: result.message || result.error };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return { success: false, error: message };
  }
}

/**
 * Process all events in the offline queue
 *
 * Returns results for each event.
 */
export async function syncOfflineQueue(baseUrl: string): Promise<SyncResult> {
  const MAX_RETRIES = 3;

  const online = await isOnline();
  if (!online) {
    console.log("[OfflineSync] Device is offline, skipping sync");
    return { success: false, synced: [], failed: [], errors: [] };
  }

  const queue = await getOfflineQueue();
  if (queue.length === 0) {
    console.log("[OfflineSync] Queue is empty");
    return { success: true, synced: [], failed: [], errors: [] };
  }

  console.log(`[OfflineSync] Processing ${queue.length} events...`);

  const synced: string[] = [];
  const failed: string[] = [];
  const errors: Array<{ id: string; error: string }> = [];

  // Process events in order (FIFO)
  for (const event of queue) {
    // Skip events that have exceeded max retries
    if (event.retryCount >= MAX_RETRIES) {
      console.log(`[OfflineSync] Event ${event.id} exceeded max retries, marking as failed`);
      failed.push(event.id);
      errors.push({ id: event.id, error: "Max retries exceeded" });
      continue;
    }

    const result = await processEvent(event, baseUrl);

    if (result.success) {
      await removeFromQueue(event.id);
      synced.push(event.id);
      console.log(`[OfflineSync] Successfully synced: ${event.id}`);
    } else {
      // Check if it's a conflict (should not retry)
      if (result.error?.startsWith("conflict:")) {
        await removeFromQueue(event.id);
        failed.push(event.id);
        errors.push({ id: event.id, error: result.error });
        console.log(`[OfflineSync] Conflict detected for ${event.id}: ${result.error}`);
      } else {
        // Network or temporary error - increment retry count
        await incrementRetryCount(event.id);
        console.log(`[OfflineSync] Failed to sync ${event.id}, will retry. Error: ${result.error}`);
      }
    }
  }

  // Update last sync timestamp
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

  return {
    success: failed.length === 0,
    synced,
    failed,
    errors,
  };
}

/**
 * Get the last successful sync timestamp
 */
export async function getLastSyncTime(): Promise<Date | null> {
  try {
    const timestamp = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return timestamp ? new Date(timestamp) : null;
  } catch {
    return null;
  }
}

/**
 * Clear the entire offline queue (use with caution)
 */
export async function clearOfflineQueue(): Promise<void> {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  console.log("[OfflineSync] Queue cleared");
}

/**
 * Create a clock-in event for offline storage
 */
export function createClockInEvent(
  userId: string,
  organizationId: string,
  location: OfflineEvent["data"]["location"],
  deviceInfo: OfflineEvent["data"]["deviceInfo"],
  note?: string
): Omit<OfflineEvent, "id" | "createdAt" | "retryCount"> {
  return {
    type: "clock_in",
    timestamp: new Date().toISOString(),
    data: {
      userId,
      organizationId,
      location,
      deviceInfo,
      note,
    },
  };
}

/**
 * Create a clock-out event for offline storage
 */
export function createClockOutEvent(
  userId: string,
  organizationId: string,
  location: OfflineEvent["data"]["location"],
  deviceInfo: OfflineEvent["data"]["deviceInfo"],
  note?: string
): Omit<OfflineEvent, "id" | "createdAt" | "retryCount"> {
  return {
    type: "clock_out",
    timestamp: new Date().toISOString(),
    data: {
      userId,
      organizationId,
      location,
      deviceInfo,
      note,
    },
  };
}

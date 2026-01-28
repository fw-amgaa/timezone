import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { Card } from "@/components/ui";
import { api } from "@/lib/api";
import { setBadgeCount } from "@/lib/notifications";
import { useTranslation } from "@/lib/i18n/context";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

// Map notification types to icons and colors
const getNotificationStyle = (type: string, colors: any) => {
  switch (type) {
    case "request_approved":
      return {
        icon: "checkmark-circle",
        color: colors.success,
        bgColor: colors.successBackground,
      };
    case "request_denied":
      return {
        icon: "close-circle",
        color: colors.error,
        bgColor: colors.errorBackground,
      };
    case "schedule_update":
      return {
        icon: "calendar",
        color: colors.info,
        bgColor: colors.infoBackground,
      };
    case "weekly_summary":
      return {
        icon: "bar-chart",
        color: colors.primary,
        bgColor: colors.primaryBackground,
      };
    case "app_update":
      return {
        icon: "download",
        color: colors.primary,
        bgColor: colors.primaryBackground,
      };
    case "clock_in_reminder":
    case "clock_out_reminder":
      return {
        icon: "alarm",
        color: colors.warning,
        bgColor: colors.warningBackground,
      };
    case "manager_alert":
      return {
        icon: "alert-circle",
        color: colors.error,
        bgColor: colors.errorBackground,
      };
    default:
      return {
        icon: "notifications",
        color: colors.textSecondary,
        bgColor: colors.backgroundTertiary,
      };
  }
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation("settings");
  const { t: tt } = useTranslation("time");

  // Format timestamp to relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return tt("relative.short.justNow");
    if (diffMins < 60) return tt("relative.short.minutesAgo", { count: diffMins });
    if (diffHours < 24) return tt("relative.short.hoursAgo", { count: diffHours });
    if (diffDays < 7) return tt("relative.short.daysAgo", { count: diffDays });
    return date.toLocaleDateString();
  };
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotifications = useCallback(
    async (reset = true) => {
      try {
        const offset = reset ? 0 : notifications.length;
        const response = await api.getNotifications({
          limit: 20,
          offset,
          unreadOnly: filter === "unread",
        });

        if (response.success) {
          if (reset) {
            setNotifications(response.notifications);
          } else {
            setNotifications((prev) => [...prev, ...response.notifications]);
          }
          setUnreadCount(response.unreadCount);
          setHasMore(response.pagination.hasMore);

          // Update app badge
          await setBadgeCount(response.unreadCount);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [filter, notifications.length]
  );

  useEffect(() => {
    setLoading(true);
    fetchNotifications(true);
  }, [filter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications(true);
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    fetchNotifications(false);
  };

  const markAsRead = async (id: string) => {
    Haptics.selectionAsync();

    // Optimistically update UI
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    // Call API
    const response = await api.markNotificationsRead({ notificationIds: [id] });
    if (!response.success) {
      // Revert on error
      fetchNotifications(true);
    } else {
      // Update badge
      await setBadgeCount(Math.max(0, unreadCount - 1));
    }
  };

  const markAllAsRead = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Optimistically update UI
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    const prevUnreadCount = unreadCount;
    setUnreadCount(0);

    // Call API
    const response = await api.markNotificationsRead({ markAllRead: true });
    if (!response.success) {
      // Revert on error
      fetchNotifications(true);
    } else {
      // Update badge
      await setBadgeCount(0);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read first
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // Navigate based on notification data
    const data = notification.data;
    if (data?.actionUrl) {
      router.push(data.actionUrl as any);
    } else if (data?.requestId) {
      // Navigate to request history
      router.push("/(tabs)/history");
    } else if (data?.shiftId) {
      router.push("/(tabs)/history");
    } else if (data?.scheduleId) {
      router.push("/calendar");
    }
  };

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  const renderNotification = ({
    item,
    index,
  }: {
    item: Notification;
    index: number;
  }) => {
    const style = getNotificationStyle(item.type, colors);

    return (
      <MotiView
        from={{ opacity: 0, translateX: -20 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: "timing", duration: 300, delay: index * 50 }}
      >
        <TouchableOpacity
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.9}
        >
          <Card
            style={
              [
                styles.notificationCard,
                !item.isRead && {
                  borderLeftWidth: 3,
                  borderLeftColor: style.color,
                },
              ] as any
            }
          >
            <View style={styles.notificationHeader}>
              <View
                style={[styles.iconContainer, { backgroundColor: style.bgColor }]}
              >
                <Ionicons
                  name={style.icon as any}
                  size={20}
                  color={style.color}
                />
              </View>

              <View style={styles.notificationContent}>
                <View style={styles.titleRow}>
                  <Text
                    style={[
                      styles.notificationTitle,
                      { color: colors.text },
                      !item.isRead && { fontWeight: "700" },
                    ]}
                  >
                    {item.title}
                  </Text>
                  {!item.isRead && (
                    <View
                      style={[
                        styles.unreadDot,
                        { backgroundColor: colors.primary },
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.notificationMessage,
                    { color: colors.textSecondary },
                  ]}
                  numberOfLines={2}
                >
                  {item.message}
                </Text>
                <Text
                  style={[styles.timestamp, { color: colors.textTertiary }]}
                >
                  {formatRelativeTime(item.createdAt)}
                </Text>
              </View>
            </View>

            {item.data?.actionUrl && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.primaryBackground },
                ]}
                onPress={() => handleNotificationPress(item)}
              >
                <Text
                  style={[styles.actionButtonText, { color: colors.primary }]}
                >
                  {t("notifications.viewDetails")}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={colors.primary}
                />
              </TouchableOpacity>
            )}
          </Card>
        </TouchableOpacity>
      </MotiView>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  // Skeleton component for loading states
  const SkeletonBox = ({ width, height, style }: { width: number | string; height: number; style?: any }) => (
    <MotiView
      from={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ loop: true, type: "timing", duration: 800 }}
      style={[
        {
          width,
          height,
          backgroundColor: colors.backgroundTertiary,
          borderRadius: 8,
        },
        style,
      ]}
    />
  );

  // Skeleton notification card for loading state
  const SkeletonNotification = ({ index }: { index: number }) => (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: "timing", duration: 300, delay: index * 50 }}
    >
      <Card style={styles.notificationCard}>
        <View style={styles.notificationHeader}>
          <SkeletonBox width={44} height={44} style={{ borderRadius: 12, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <SkeletonBox width="70%" height={18} style={{ marginBottom: 8 }} />
            <SkeletonBox width="90%" height={14} style={{ marginBottom: 4 }} />
            <SkeletonBox width="40%" height={14} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Card>
    </MotiView>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.backButton,
            { backgroundColor: colors.backgroundTertiary },
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("notifications.title")}
          </Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.error }]}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={markAllAsRead}
            style={[
              styles.markAllButton,
              { backgroundColor: colors.backgroundTertiary },
            ]}
          >
            <Feather name="check-circle" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View style={{ width: 40 }} />}
      </View>

      {/* Filter Tabs */}
      <View
        style={[
          styles.filterContainer,
          { backgroundColor: colors.backgroundSecondary },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            setFilter("all");
          }}
          style={[
            styles.filterTab,
            filter === "all" && { backgroundColor: colors.background },
          ]}
        >
          <Text
            style={[
              styles.filterText,
              {
                color: filter === "all" ? colors.primary : colors.textSecondary,
              },
            ]}
          >
            {t("notifications.filters.all")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            setFilter("unread");
          }}
          style={[
            styles.filterTab,
            filter === "unread" && { backgroundColor: colors.background },
          ]}
        >
          <Text
            style={[
              styles.filterText,
              {
                color:
                  filter === "unread" ? colors.primary : colors.textSecondary,
              },
            ]}
          >
            {t("notifications.filters.unread")} ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      {loading ? (
        <View style={styles.listContent}>
          {[0, 1, 2, 3].map((index) => (
            <SkeletonNotification key={index} index={index} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MotiView
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 15 }}
              >
                <View
                  style={[
                    styles.emptyIcon,
                    { backgroundColor: colors.backgroundTertiary },
                  ]}
                >
                  <Ionicons
                    name="notifications-off"
                    size={40}
                    color={colors.textTertiary}
                  />
                </View>
              </MotiView>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {filter === "unread" ? t("notifications.empty.allCaughtUp") : t("notifications.empty.noNotifications")}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {filter === "unread"
                  ? t("notifications.empty.allReadDesc")
                  : t("notifications.empty.noNotificationsDesc")}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  markAllButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 16,
    padding: 4,
    borderRadius: 10,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  notificationCard: {
    marginBottom: 12,
    padding: 0,
    overflow: "hidden",
  },
  notificationHeader: {
    flexDirection: "row",
    padding: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: "center",
  },
});

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView, AnimatePresence } from "moti";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { Card } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDurationFromMinutes } from "@timezone/utils/shifts";
import { useTranslation } from "@/lib/i18n/context";

type FilterPeriod = "week" | "month" | "all";

interface Shift {
  id: string;
  date: string;
  dayOfWeek: string;
  clockIn: string;
  clockOut: string | null;
  duration: number;
  location: string;
  status: "completed" | "active" | "revised" | "pending" | "stale";
  crossedMidnight?: boolean;
  wasOutOfRange?: boolean;
  breakMinutes?: number;
}

interface Summary {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  shiftsCompleted: number;
  avgPerDay: number;
  activeShifts: number;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation("dashboard");
  const { t: tc } = useTranslation("common");
  const { t: tt } = useTranslation("time");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterPeriod>("week");
  const [expandedShift, setExpandedShift] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalHours: 0,
    regularHours: 0,
    overtimeHours: 0,
    shiftsCompleted: 0,
    avgPerDay: 0,
    activeShifts: 0,
  });

  const fetchHistory = useCallback(async (period: FilterPeriod) => {
    try {
      const response = await api.getShiftHistory({ period });
      if (response.success) {
        setShifts(response.shifts || []);
        setSummary(
          response.summary || {
            totalHours: 0,
            regularHours: 0,
            overtimeHours: 0,
            shiftsCompleted: 0,
            avgPerDay: 0,
            activeShifts: 0,
          }
        );
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchHistory(selectedFilter);
      setIsLoading(false);
    };
    loadData();
  }, [selectedFilter, fetchHistory]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchHistory(selectedFilter);
    setIsRefreshing(false);
  }, [selectedFilter, fetchHistory]);

  const handleFilterChange = useCallback((filter: FilterPeriod) => {
    Haptics.selectionAsync();
    setSelectedFilter(filter);
    setExpandedShift(null);
  }, []);

  const toggleExpanded = (id: string) => {
    Haptics.selectionAsync();
    setExpandedShift(expandedShift === id ? null : id);
  };

  const getStatusColor = (status: Shift["status"]) => {
    switch (status) {
      case "active":
        return colors.success;
      case "completed":
        return colors.primary;
      case "revised":
        return colors.warning;
      case "pending":
        return colors.info;
      case "stale":
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusBgColor = (status: Shift["status"]) => {
    switch (status) {
      case "active":
        return colors.successBackground;
      case "completed":
        return colors.primaryBackground;
      case "revised":
        return colors.warningBackground;
      case "pending":
        return colors.infoBackground;
      case "stale":
        return colors.errorBackground;
      default:
        return colors.backgroundTertiary;
    }
  };

  const getStatusLabel = (status: Shift["status"]) => {
    switch (status) {
      case "active":
        return tc("status.active");
      case "completed":
        return tc("status.completed");
      case "revised":
        return tc("status.revised");
      case "pending":
        return tc("status.pending");
      case "stale":
        return tc("status.stale");
      default:
        return status;
    }
  };

  const getPeriodLabel = (period: FilterPeriod) => {
    switch (period) {
      case "week":
        return tt("periods.thisWeek");
      case "month":
        return tt("periods.thisMonth");
      case "all":
        return tt("periods.allTime");
    }
  };

  // Skeleton component for loading states
  const SkeletonBox = ({
    width,
    height,
    style,
  }: {
    width: number | string;
    height: number;
    style?: any;
  }) => (
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t("history.title")}
          </Text>
          <Text
            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
          >
            {t("history.subtitle")}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.exportButton,
            { backgroundColor: colors.backgroundTertiary },
          ]}
        >
          <Feather name="download" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Card - Show skeleton while loading */}
        {isLoading ? (
          <View
            style={[styles.summaryCard, { backgroundColor: colors.primary }]}
          >
            <View style={styles.summaryHeader}>
              <View>
                <SkeletonBox
                  width={80}
                  height={16}
                  style={{
                    marginBottom: 8,
                    backgroundColor: "rgba(255,255,255,0.2)",
                  }}
                />
                <SkeletonBox
                  width={120}
                  height={48}
                  style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                />
              </View>
              <SkeletonBox
                width={52}
                height={52}
                style={{
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.15)",
                }}
              />
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStats}>
              {[1, 2, 3, 4].map((i) => (
                <React.Fragment key={i}>
                  {i > 1 && <View style={styles.summaryStatDivider} />}
                  <View style={styles.summaryStatItem}>
                    <SkeletonBox
                      width={24}
                      height={14}
                      style={{
                        marginBottom: 6,
                        backgroundColor: "rgba(255,255,255,0.2)",
                      }}
                    />
                    <SkeletonBox
                      width={40}
                      height={12}
                      style={{
                        marginBottom: 2,
                        backgroundColor: "rgba(255,255,255,0.2)",
                      }}
                    />
                    <SkeletonBox
                      width={30}
                      height={16}
                      style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                    />
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        ) : (
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 15 }}
          >
            <LinearGradient
              colors={
                isDark
                  ? [colors.primary, colors.primaryDark]
                  : [colors.primary, colors.primaryDark]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCard}
            >
              <View style={styles.summaryHeader}>
                <View>
                  <Text style={styles.summaryLabel}>
                    {getPeriodLabel(selectedFilter)}
                  </Text>
                  <View style={styles.summaryMainValue}>
                    <Text style={styles.summaryHours}>
                      {summary.totalHours}
                    </Text>
                    <Text style={styles.summaryHoursUnit}>
                      {tt("units.hours")}
                    </Text>
                  </View>
                </View>
                <View style={styles.summaryIcon}>
                  <Ionicons
                    name="time"
                    size={28}
                    color="rgba(255,255,255,0.9)"
                  />
                </View>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryStats}>
                <View style={styles.summaryStatItem}>
                  <View style={styles.summaryStatIcon}>
                    <Feather
                      name="clock"
                      size={14}
                      color="rgba(255,255,255,0.8)"
                    />
                  </View>
                  <Text style={styles.summaryStatLabel}>
                    {t("stats.regular")}
                  </Text>
                  <Text style={styles.summaryStatValue}>
                    {summary.regularHours}
                    {tt("units.h")}
                  </Text>
                </View>

                <View style={styles.summaryStatDivider} />

                <View style={styles.summaryStatItem}>
                  <View style={styles.summaryStatIcon}>
                    <Feather
                      name="trending-up"
                      size={14}
                      color="rgba(255,255,255,0.8)"
                    />
                  </View>
                  <Text style={styles.summaryStatLabel}>
                    {t("stats.overtime")}
                  </Text>
                  <Text style={styles.summaryStatValue}>
                    {summary.overtimeHours}
                    {tt("units.h")}
                  </Text>
                </View>

                <View style={styles.summaryStatDivider} />

                <View style={styles.summaryStatItem}>
                  <View style={styles.summaryStatIcon}>
                    <Feather
                      name="calendar"
                      size={14}
                      color="rgba(255,255,255,0.8)"
                    />
                  </View>
                  <Text style={styles.summaryStatLabel}>
                    {t("stats.shifts")}
                  </Text>
                  <Text style={styles.summaryStatValue}>
                    {summary.shiftsCompleted}
                  </Text>
                </View>

                <View style={styles.summaryStatDivider} />

                <View style={styles.summaryStatItem}>
                  <View style={styles.summaryStatIcon}>
                    <Feather
                      name="bar-chart-2"
                      size={14}
                      color="rgba(255,255,255,0.8)"
                    />
                  </View>
                  <Text style={styles.summaryStatLabel}>
                    {t("stats.avgPerDay")}
                  </Text>
                  <Text style={styles.summaryStatValue}>
                    {summary.avgPerDay}
                    {tt("units.h")}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </MotiView>
        )}

        {/* Filter Tabs */}
        <View
          style={[
            styles.filterContainer,
            { backgroundColor: colors.backgroundSecondary },
          ]}
        >
          {(["week", "month", "all"] as FilterPeriod[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              onPress={() => handleFilterChange(filter)}
              style={[
                styles.filterTab,
                selectedFilter === filter && {
                  backgroundColor: colors.background,
                  shadowColor: colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  {
                    color:
                      selectedFilter === filter
                        ? colors.primary
                        : colors.textSecondary,
                    fontWeight: selectedFilter === filter ? "600" : "500",
                  },
                ]}
              >
                {getPeriodLabel(filter)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t("history.recentShifts")}
          </Text>
          {!isLoading && (
            <Text style={[styles.sectionCount, { color: colors.textTertiary }]}>
              {shifts.length} {t("history.entries")}
            </Text>
          )}
        </View>

        {/* Loading Skeleton for Shifts */}
        {isLoading && (
          <>
            {[1, 2, 3].map((i) => (
              <MotiView
                key={`skeleton-${i}`}
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 300, delay: i * 80 }}
              >
                <Card style={styles.shiftCard} padding="none">
                  <View style={styles.shiftContent}>
                    <SkeletonBox
                      width={52}
                      height={52}
                      style={{ borderRadius: 12, marginRight: 12 }}
                    />
                    <View style={{ flex: 1 }}>
                      <SkeletonBox
                        width={80}
                        height={16}
                        style={{ marginBottom: 8 }}
                      />
                      <SkeletonBox
                        width={140}
                        height={14}
                        style={{ marginBottom: 6 }}
                      />
                      <SkeletonBox width={100} height={12} />
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <SkeletonBox
                        width={50}
                        height={20}
                        style={{ marginBottom: 8 }}
                      />
                      <SkeletonBox
                        width={60}
                        height={22}
                        style={{ borderRadius: 6 }}
                      />
                    </View>
                  </View>
                </Card>
              </MotiView>
            ))}
          </>
        )}

        {/* Empty State */}
        {!isLoading && shifts.length === 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 300 }}
          >
            <Card style={styles.emptyCard}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.primaryBackground },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={40}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t("history.noShifts")}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t("history.noShiftsDescription")}
              </Text>
            </Card>
          </MotiView>
        )}

        {/* Shift List */}
        {!isLoading &&
          shifts.map((shift, index) => (
            <MotiView
              key={shift.id}
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 300, delay: index * 80 }}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => toggleExpanded(shift.id)}
              >
                <Card
                  style={[
                    styles.shiftCard,
                    expandedShift === shift.id && {
                      borderColor: colors.primary,
                      borderWidth: 1,
                    },
                  ]}
                  padding="none"
                >
                  {/* Active Shift Indicator */}
                  {shift.status === "active" && (
                    <View
                      style={[
                        styles.activeIndicator,
                        { backgroundColor: colors.success },
                      ]}
                    >
                      <MotiView
                        from={{ opacity: 0.5 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          loop: true,
                          type: "timing",
                          duration: 1000,
                        }}
                      >
                        <Text style={styles.activeIndicatorText}>
                          {t("history.currentlyActive")}
                        </Text>
                      </MotiView>
                    </View>
                  )}

                  {/* Main Content */}
                  <View style={styles.shiftContent}>
                    {/* Left: Date Badge */}
                    <View
                      style={[
                        styles.dateBadge,
                        { backgroundColor: colors.backgroundSecondary },
                      ]}
                    >
                      <Text style={[styles.dateNumber, { color: colors.text }]}>
                        {shift.date.split(" ")[1]}
                      </Text>
                      <Text
                        style={[
                          styles.dateMonth,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {shift.date.split(" ")[0]}
                      </Text>
                    </View>

                    {/* Middle: Shift Details */}
                    <View style={styles.shiftDetails}>
                      <View style={styles.shiftTimeRow}>
                        <Text style={[styles.shiftDay, { color: colors.text }]}>
                          {shift.dayOfWeek}
                        </Text>
                        <View style={styles.badgesRow}>
                          {shift.crossedMidnight && (
                            <View
                              style={[
                                styles.badge,
                                { backgroundColor: colors.infoBackground },
                              ]}
                            >
                              <Ionicons
                                name="moon"
                                size={10}
                                color={colors.info}
                              />
                              <Text
                                style={[
                                  styles.badgeText,
                                  { color: colors.info },
                                ]}
                              >
                                {t("history.night")}
                              </Text>
                            </View>
                          )}
                          {shift.wasOutOfRange && (
                            <View
                              style={[
                                styles.badge,
                                { backgroundColor: colors.warningBackground },
                              ]}
                            >
                              <MaterialCommunityIcons
                                name="map-marker-alert"
                                size={10}
                                color={colors.warning}
                              />
                              <Text
                                style={[
                                  styles.badgeText,
                                  { color: colors.warning },
                                ]}
                              >
                                {t("history.remote")}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.timeContainer}>
                        <View style={styles.timeBlock}>
                          <View
                            style={[
                              styles.timeDot,
                              { backgroundColor: colors.success },
                            ]}
                          />
                          <Text
                            style={[styles.timeText, { color: colors.text }]}
                          >
                            {shift.clockIn}
                          </Text>
                        </View>
                        <Ionicons
                          name="arrow-forward"
                          size={14}
                          color={colors.textTertiary}
                          style={{ marginHorizontal: 8 }}
                        />
                        <View style={styles.timeBlock}>
                          <View
                            style={[
                              styles.timeDot,
                              {
                                backgroundColor: shift.clockOut
                                  ? colors.error
                                  : colors.textTertiary,
                              },
                            ]}
                          />
                          <Text
                            style={[styles.timeText, { color: colors.text }]}
                          >
                            {shift.clockOut || "—"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.locationRow}>
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color={colors.textTertiary}
                        />
                        <Text
                          style={[
                            styles.locationText,
                            { color: colors.textTertiary },
                          ]}
                          numberOfLines={1}
                        >
                          {shift.location}
                        </Text>
                      </View>
                    </View>

                    {/* Right: Duration & Status */}
                    <View style={styles.shiftRight}>
                      <Text
                        style={[styles.duration, { color: colors.primary }]}
                      >
                        {formatDurationFromMinutes(shift.duration)}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusBgColor(shift.status) },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: getStatusColor(shift.status) },
                          ]}
                        >
                          {getStatusLabel(shift.status)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedShift === shift.id && (
                      <MotiView
                        from={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ type: "timing", duration: 200 }}
                      >
                        <View
                          style={[
                            styles.expandedContent,
                            { borderTopColor: colors.border },
                          ]}
                        >
                          <View style={styles.expandedRow}>
                            <View style={styles.expandedItem}>
                              <Feather
                                name="coffee"
                                size={14}
                                color={colors.textSecondary}
                              />
                              <Text
                                style={[
                                  styles.expandedLabel,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {t("history.break")}
                              </Text>
                              <Text
                                style={[
                                  styles.expandedValue,
                                  { color: colors.text },
                                ]}
                              >
                                {shift.breakMinutes || 0} {tt("units.min")}
                              </Text>
                            </View>
                            <View style={styles.expandedItem}>
                              <Feather
                                name="clock"
                                size={14}
                                color={colors.textSecondary}
                              />
                              <Text
                                style={[
                                  styles.expandedLabel,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {t("history.netHours")}
                              </Text>
                              <Text
                                style={[
                                  styles.expandedValue,
                                  { color: colors.text },
                                ]}
                              >
                                {(
                                  (shift.duration - (shift.breakMinutes || 0)) /
                                  60
                                ).toFixed(1)}
                                {tt("units.h")}
                              </Text>
                            </View>
                            <View style={styles.expandedItem}>
                              <Feather
                                name="map-pin"
                                size={14}
                                color={colors.textSecondary}
                              />
                              <Text
                                style={[
                                  styles.expandedLabel,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                {t("history.type")}
                              </Text>
                              <Text
                                style={[
                                  styles.expandedValue,
                                  { color: colors.text },
                                ]}
                              >
                                {shift.wasOutOfRange
                                  ? t("history.remote")
                                  : t("history.onSite")}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </MotiView>
                    )}
                  </AnimatePresence>

                  {/* Expand Indicator */}
                  <View style={styles.expandIndicator}>
                    <Ionicons
                      name={
                        expandedShift === shift.id
                          ? "chevron-up"
                          : "chevron-down"
                      }
                      size={18}
                      color={colors.textTertiary}
                    />
                  </View>
                </Card>
              </TouchableOpacity>
            </MotiView>
          ))}

        {/* Bottom Padding */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  exportButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
    marginBottom: 4,
  },
  summaryMainValue: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  summaryHours: {
    fontSize: 48,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  summaryHoursUnit: {
    fontSize: 18,
    color: "rgba(255,255,255,0.8)",
    marginLeft: 6,
    fontWeight: "500",
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 16,
  },
  summaryStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryStatItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryStatIcon: {
    marginBottom: 6,
  },
  summaryStatLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
    marginBottom: 2,
  },
  summaryStatValue: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  summaryStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  filterContainer: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    marginBottom: 20,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  filterTabText: {
    fontSize: 14,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  sectionCount: {
    fontSize: 13,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  shiftCard: {
    marginBottom: 12,
    overflow: "hidden",
  },
  activeIndicator: {
    paddingVertical: 6,
    alignItems: "center",
  },
  activeIndicatorText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  shiftContent: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
  },
  dateBadge: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  dateNumber: {
    fontSize: 20,
    fontWeight: "700",
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  shiftDetails: {
    flex: 1,
  },
  shiftTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  shiftDay: {
    fontSize: 15,
    fontWeight: "600",
  },
  badgesRow: {
    flexDirection: "row",
    gap: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  timeBlock: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  timeText: {
    fontSize: 14,
    fontWeight: "500",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    flex: 1,
  },
  shiftRight: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  duration: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  expandedContent: {
    padding: 16,
    borderTopWidth: 1,
  },
  expandedRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  expandedItem: {
    alignItems: "center",
    gap: 4,
  },
  expandedLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  expandedValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  expandIndicator: {
    alignItems: "center",
    paddingBottom: 8,
  },
});

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { Card } from "@/components/ui";
import { api } from "@/lib/api";
import { useTranslation } from "@/lib/i18n/context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DAY_WIDTH = (SCREEN_WIDTH - 40 - 12) / 7;

interface ShiftEntry {
  id: string;
  date: string;
  dayOfWeek: string;
  clockIn: string;
  clockOut: string | null;
  duration: number;
  location: string;
  status: "completed" | "active" | "revised" | "pending" | "stale";
  crossedMidnight: boolean;
  wasOutOfRange: boolean;
  breakMinutes: number;
  clockInAt: string;
  clockOutAt: string | null;
  shiftDate: string;
}

interface DayEntry {
  date: Date;
  status: "worked" | "active" | "revised" | "stale" | "weekend" | null;
  hours?: number;
  isToday?: boolean;
  shifts?: ShiftEntry[];
}

interface Summary {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  shiftsCompleted: number;
  avgPerDay: number;
  activeShifts: number;
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MONTH_KEYS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

export default function CalendarScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation("clock");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data from API
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [weekSummary, setWeekSummary] = useState<Summary | null>(null);
  const [monthSummary, setMonthSummary] = useState<Summary | null>(null);
  const [shiftsByDate, setShiftsByDate] = useState<Record<string, ShiftEntry[]>>({});

  const fetchData = useCallback(async () => {
    try {
      // Fetch both week and month data
      const [weekResponse, monthResponse] = await Promise.all([
        api.getShiftHistory({ period: "week", limit: 100 }),
        api.getShiftHistory({ period: "month", limit: 100 }),
      ]);

      if (monthResponse.success && monthResponse.shifts) {
        setShifts(monthResponse.shifts);
        setMonthSummary(monthResponse.summary);

        // Group shifts by date for calendar display
        const grouped: Record<string, ShiftEntry[]> = {};
        monthResponse.shifts.forEach((shift) => {
          const dateKey = new Date(shift.shiftDate).toISOString().split("T")[0];
          if (!grouped[dateKey]) {
            grouped[dateKey] = [];
          }
          grouped[dateKey].push(shift);
        });
        setShiftsByDate(grouped);
      }

      if (weekResponse.success && weekResponse.summary) {
        setWeekSummary(weekResponse.summary);
      }
    } catch (error) {
      console.error("Failed to fetch calendar data:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: (DayEntry | null)[] = [];

    // Add empty slots for padding
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // Add actual days
    const today = new Date();
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday =
        today.getDate() === day &&
        today.getMonth() === month &&
        today.getFullYear() === year;

      const dayShifts = shiftsByDate[dateKey] || [];
      let status: DayEntry["status"] = null;
      let totalHours = 0;

      if (dayShifts.length > 0) {
        // Calculate total hours for the day
        totalHours = dayShifts.reduce((sum, s) => sum + (s.duration / 60), 0);

        // Determine status based on shift statuses
        const hasActive = dayShifts.some(s => s.status === "active");
        const hasStale = dayShifts.some(s => s.status === "stale");
        const hasRevised = dayShifts.some(s => s.status === "revised");

        if (hasActive) {
          status = "active";
        } else if (hasStale) {
          status = "stale";
        } else if (hasRevised) {
          status = "revised";
        } else {
          status = "worked";
        }
      } else if (isWeekend) {
        status = "weekend";
      }

      days.push({
        date,
        status,
        isToday,
        hours: totalHours > 0 ? Math.round(totalHours * 10) / 10 : undefined,
        shifts: dayShifts,
      });
    }

    return days;
  };

  const goToPrevMonth = () => {
    Haptics.selectionAsync();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    Haptics.selectionAsync();
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDayPress = (day: DayEntry) => {
    Haptics.selectionAsync();
    setSelectedDate(day.date);
  };

  const getStatusColor = (status: DayEntry["status"]) => {
    switch (status) {
      case "worked":
        return colors.success;
      case "active":
        return colors.primary;
      case "revised":
        return colors.info;
      case "stale":
        return colors.warning;
      case "weekend":
        return colors.textTertiary;
      default:
        return "transparent";
    }
  };

  const getEntryStatusColor = (status: ShiftEntry["status"]) => {
    switch (status) {
      case "completed":
        return colors.success;
      case "active":
        return colors.primary;
      case "revised":
        return colors.info;
      case "pending":
        return colors.warning;
      case "stale":
        return colors.error;
      default:
        return colors.textTertiary;
    }
  };

  const getEntryStatusLabel = (status: ShiftEntry["status"]) => {
    switch (status) {
      case "completed":
        return t("calendar.status.completed");
      case "active":
        return t("calendar.status.active");
      case "revised":
        return t("calendar.status.revised");
      case "pending":
        return t("calendar.status.pending");
      case "stale":
        return t("calendar.status.stale");
      default:
        return status;
    }
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const days = generateCalendarDays();

  // Get selected day shifts
  const selectedDayKey = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : null;
  const selectedDayShifts = selectedDayKey ? shiftsByDate[selectedDayKey] || [] : [];

  // Weekly stats
  const totalHoursThisWeek = weekSummary?.totalHours || 0;
  const expectedHours = 40;
  const daysWorked = weekSummary?.shiftsCompleted || 0;

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.backgroundTertiary }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("calendar.title")}</Text>
        <TouchableOpacity
          style={[styles.todayButton, { backgroundColor: colors.primaryBackground }]}
          onPress={() => {
            setCurrentMonth(new Date());
            setSelectedDate(new Date());
          }}
        >
          <Text style={[styles.todayButtonText, { color: colors.primary }]}>{t("calendar.today")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <MotiView
            key={currentMonth.toISOString()}
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "timing", duration: 200 }}
          >
            <Text style={[styles.monthTitle, { color: colors.text }]}>
              {t(`calendar.months.${MONTH_KEYS[currentMonth.getMonth()]}`)} {currentMonth.getFullYear()}
            </Text>
          </MotiView>
          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <Card style={{ marginHorizontal: 20, marginBottom: 20, padding: 12 }}>
          {/* Weekday Headers */}
          <View style={styles.weekdayRow}>
            {WEEKDAY_KEYS.map((dayKey) => (
              <View key={dayKey} style={styles.weekdayCell}>
                <Text style={[styles.weekdayText, { color: colors.textTertiary }]}>
                  {t(`calendar.weekdays.${dayKey}`)}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Days */}
          <View style={styles.daysGrid}>
            {days.map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  day?.isToday && { backgroundColor: colors.primaryBackground },
                  selectedDate &&
                    day?.date?.toDateString() === selectedDate.toDateString() && {
                      borderWidth: 2,
                      borderColor: colors.primary,
                    },
                ]}
                disabled={!day}
                onPress={() => day && handleDayPress(day)}
              >
                {day && (
                  <>
                    <Text
                      style={[
                        styles.dayText,
                        { color: day.status === "weekend" ? colors.textTertiary : colors.text },
                        day.isToday && { color: colors.primary, fontWeight: "700" },
                      ]}
                    >
                      {day.date.getDate()}
                    </Text>
                    {day.status && day.status !== "weekend" && (
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: getStatusColor(day.status) },
                        ]}
                      />
                    )}
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Legend */}
          <View style={[styles.legend, { borderTopColor: colors.border }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t("calendar.legend.worked")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t("calendar.legend.active")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t("calendar.legend.stale")}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t("calendar.legend.revised")}</Text>
            </View>
          </View>
        </Card>

        {/* Weekly Stats */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t("calendar.thisWeek")}
          </Text>
          {isLoading ? (
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <SkeletonBox width={44} height={44} style={{ borderRadius: 12, marginBottom: 12 }} />
                <SkeletonBox width={60} height={28} style={{ marginBottom: 4 }} />
                <SkeletonBox width={50} height={16} style={{ marginBottom: 12 }} />
                <SkeletonBox width="100%" height={4} style={{ borderRadius: 2 }} />
              </Card>
              <Card style={styles.statCard}>
                <SkeletonBox width={44} height={44} style={{ borderRadius: 12, marginBottom: 12 }} />
                <SkeletonBox width={40} height={28} style={{ marginBottom: 4 }} />
                <SkeletonBox width={80} height={16} />
              </Card>
            </View>
          ) : (
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: colors.primaryBackground }]}>
                  <Feather name="clock" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {totalHoursThisWeek}h
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {t("calendar.ofHours", { hours: expectedHours })}
                </Text>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.primary,
                        width: `${Math.min((totalHoursThisWeek / expectedHours) * 100, 100)}%`,
                      },
                    ]}
                  />
                </View>
              </Card>

              <Card style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: colors.successBackground }]}>
                  <Feather name="calendar" size={20} color={colors.success} />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {daysWorked}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {t("calendar.shiftsCompleted")}
                </Text>
              </Card>
            </View>
          )}
        </View>

        {/* Selected Day Entries */}
        <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {selectedDate
              ? selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : t("calendar.selectDay")}
          </Text>

          {selectedDayShifts.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t("calendar.noShiftsOnDay")}
              </Text>
            </Card>
          ) : (
            selectedDayShifts.map((entry, index) => (
              <MotiView
                key={entry.id}
                from={{ opacity: 0, translateX: -20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: "timing", duration: 300, delay: index * 100 }}
              >
                <Card style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <View style={styles.entryDate}>
                      <Text style={[styles.entryDateText, { color: colors.text }]}>
                        {entry.dayOfWeek}, {entry.date}
                      </Text>
                      {entry.wasOutOfRange && (
                        <View style={[styles.outOfRangeBadge, { backgroundColor: colors.warningBackground }]}>
                          <MaterialCommunityIcons
                            name="map-marker-alert"
                            size={12}
                            color={colors.warning}
                          />
                          <Text style={[styles.outOfRangeText, { color: colors.warning }]}>
                            {t("calendar.entry.remote")}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: `${getEntryStatusColor(entry.status)}20` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getEntryStatusColor(entry.status) },
                        ]}
                      >
                        {getEntryStatusLabel(entry.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.entryTimes}>
                    <View style={styles.timeBlock}>
                      <Text style={[styles.timeLabel, { color: colors.textTertiary }]}>
                        {t("calendar.entry.clockIn")}
                      </Text>
                      <Text style={[styles.timeValue, { color: colors.success }]}>
                        {entry.clockIn}
                      </Text>
                    </View>
                    <View style={[styles.timeDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.timeBlock}>
                      <Text style={[styles.timeLabel, { color: colors.textTertiary }]}>
                        {t("calendar.entry.clockOut")}
                      </Text>
                      <Text style={[styles.timeValue, { color: entry.clockOut ? colors.error : colors.textTertiary }]}>
                        {entry.clockOut || t("calendar.entry.active")}
                      </Text>
                    </View>
                    <View style={[styles.timeDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.timeBlock}>
                      <Text style={[styles.timeLabel, { color: colors.textTertiary }]}>
                        {t("calendar.entry.duration")}
                      </Text>
                      <Text style={[styles.timeValue, { color: colors.text }]}>
                        {formatDuration(entry.duration)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.entryLocation, { borderTopColor: colors.border }]}>
                    <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
                    <Text style={[styles.locationText, { color: colors.textTertiary }]}>
                      {entry.location}
                    </Text>
                  </View>
                </Card>
              </MotiView>
            ))
          )}
        </View>
      </ScrollView>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayCell: {
    width: DAY_WIDTH,
    alignItems: "center",
    paddingVertical: 8,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: "600",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: DAY_WIDTH,
    height: DAY_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dayText: {
    fontSize: 15,
    fontWeight: "500",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: 16,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  progressBar: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
  },
  entryCard: {
    marginBottom: 12,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  entryDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryDateText: {
    fontSize: 15,
    fontWeight: "600",
  },
  outOfRangeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  outOfRangeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  entryTimes: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeBlock: {
    flex: 1,
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  timeDivider: {
    width: 1,
    height: 30,
  },
  entryLocation: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 6,
  },
  locationText: {
    fontSize: 13,
  },
});

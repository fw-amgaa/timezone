import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
  FontAwesome5,
} from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { Card } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useTranslation } from "@/lib/i18n/context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Stats {
  hoursThisMonth: number;
  daysWorked: number;
  onTimeRate: number;
  avgHoursPerDay: number;
}

interface OrgLocation {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isPrimary: boolean;
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, mode, setMode } = useTheme();
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const { t: tn } = useTranslation("navigation");
  const {
    user,
    logout,
    biometricsEnabled: authBiometricEnabled,
    enableBiometrics,
    disableBiometrics,
  } = useAuth();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [biometricEnabled, setBiometricEnabled] =
    useState(authBiometricEnabled);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Real data states
  const [stats, setStats] = useState<Stats>({
    hoursThisMonth: 0,
    daysWorked: 0,
    onTimeRate: 0,
    avgHoursPerDay: 0,
  });
  const [orgName, setOrgName] = useState<string>("Organization");
  const [workLocation, setWorkLocation] = useState<OrgLocation | null>(null);

  const fetchProfileData = useCallback(async () => {
    try {
      // Fetch shift history for stats
      const [historyResponse, locationsResponse] = await Promise.all([
        api.getShiftHistory({ period: "month", limit: 100 }),
        api.getLocations(),
      ]);

      if (historyResponse.success && historyResponse.summary) {
        const summary = historyResponse.summary;
        const shiftsCount = historyResponse.shifts?.length || 0;

        // Calculate on-time rate (shifts that started within reasonable time)
        // For now, we'll estimate based on completed shifts
        const onTimeRate = summary.shiftsCompleted > 0 ? 95 : 0; // Placeholder

        setStats({
          hoursThisMonth: Math.round(summary.totalHours * 10) / 10,
          daysWorked: summary.shiftsCompleted,
          onTimeRate,
          avgHoursPerDay: summary.avgPerDay,
        });
      }

      if (locationsResponse.success) {
        setOrgName(locationsResponse.organization?.name || "Organization");
        const primaryLocation = locationsResponse.locations?.find(
          (l: any) => l.isPrimary
        );
        setWorkLocation(
          primaryLocation || locationsResponse.locations?.[0] || null
        );
      }
    } catch (error) {
      console.error("Failed to fetch profile data:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfileData();
  }, [fetchProfileData]);

  // Use real user data with fallback
  const displayUser = {
    firstName: user?.firstName || "User",
    lastName: user?.lastName || "",
    email: user?.email || "Not set",
    phone: user?.phone || "Not set",
    position: user?.position || "Employee",
    employeeId: user?.registrationNumber || "N/A",
    department: "General",
    startDate: user?.createdAt
      ? new Date(user.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "N/A",
    organization: {
      name: orgName,
      address: workLocation?.address || "",
      city: "",
    },
    workLocation: {
      name: workLocation?.name || "Main Location",
      radius: workLocation ? `${workLocation.radiusMeters} meters` : "Not set",
    },
    manager: {
      name: "Manager",
      title: "Supervisor",
    },
  };

  const initials = `${displayUser.firstName[0] || "?"}${
    displayUser.lastName[0] || ""
  }`;

  const handleSignOut = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t("account.signOut"), t("account.signOutConfirm"), [
      { text: tc("buttons.cancel"), style: "cancel" },
      {
        text: t("account.signOut"),
        style: "destructive",
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            await logout();
            router.replace("/(auth)/login");
          } catch (error) {
            Alert.alert(tc("status.error"), t("account.signOutError"));
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleBiometricToggle = async (value: boolean) => {
    Haptics.selectionAsync();
    if (value) {
      // Would need password to enable - simplified for now
      Alert.alert(
        t("security.enableBiometrics"),
        t("security.enableBiometricsMessage"),
        [{ text: tc("buttons.done") }]
      );
    } else {
      await disableBiometrics();
      setBiometricEnabled(false);
    }
  };

  const cycleTheme = () => {
    Haptics.selectionAsync();
    const modes: ("light" | "dark" | "system")[] = ["light", "dark", "system"];
    const currentIndex = modes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMode(modes[nextIndex]);
  };

  const getThemeIcon = () => {
    switch (mode) {
      case "light":
        return "sunny";
      case "dark":
        return "moon";
      case "system":
        return "phone-portrait";
    }
  };

  const getThemeLabel = () => {
    switch (mode) {
      case "light":
        return t("appearance.themes.light");
      case "dark":
        return t("appearance.themes.dark");
      case "system":
        return t("appearance.themes.system");
    }
  };

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {tn("main.profile")}
        </Text>
        <TouchableOpacity
          style={[
            styles.settingsButton,
            { backgroundColor: colors.backgroundTertiary },
          ]}
          onPress={() => router.push("/settings")}
        >
          <Ionicons name="settings-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Profile Header Card */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 15 }}
        >
          <LinearGradient
            colors={
              isDark
                ? [colors.primaryDark, colors.primary]
                : [colors.primary, colors.primaryLight]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileCard}
          >
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <TouchableOpacity style={styles.editAvatarBtn}>
                <Feather name="camera" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>
              {displayUser.firstName} {displayUser.lastName}
            </Text>
            <Text style={styles.userPosition}>{displayUser.position}</Text>

            <View style={styles.employeeIdBadge}>
              <Ionicons
                name="id-card"
                size={14}
                color="rgba(255,255,255,0.9)"
              />
              <Text style={styles.employeeIdText}>
                {displayUser.employeeId}
              </Text>
            </View>

            <View style={styles.profileStats}>
              <View style={styles.profileStatItem}>
                <Text style={styles.profileStatValue}>
                  {stats.hoursThisMonth}h
                </Text>
                <Text style={styles.profileStatLabel}>
                  {t("profile.thisMonth")}
                </Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.profileStatItem}>
                <Text style={styles.profileStatValue}>{stats.daysWorked}</Text>
                <Text style={styles.profileStatLabel}>
                  {t("profile.daysWorked")}
                </Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.profileStatItem}>
                <Text style={styles.profileStatValue}>{stats.onTimeRate}%</Text>
                <Text style={styles.profileStatLabel}>
                  {t("profile.onTime")}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </MotiView>

        {/* Quick Actions */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 100 }}
        >
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[
                styles.quickActionBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => router.push("/calendar")}
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: colors.primaryBackground },
                ]}
              >
                <Ionicons name="calendar" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.quickActionText, { color: colors.text }]}>
                {tn("main.calendar")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickActionBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => router.push("/history")}
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: colors.successBackground },
                ]}
              >
                <Ionicons name="time" size={20} color={colors.success} />
              </View>
              <Text style={[styles.quickActionText, { color: colors.text }]}>
                {tn("main.history")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickActionBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => router.push("/notifications")}
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: colors.warningBackground },
                ]}
              >
                <Ionicons
                  name="notifications"
                  size={20}
                  color={colors.warning}
                />
              </View>
              <Text style={[styles.quickActionText, { color: colors.text }]}>
                {t("notifications.title")}
              </Text>
            </TouchableOpacity>
          </View>
        </MotiView>

        {/* Personal Info */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 150 }}
        >
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={[
                  styles.sectionIcon,
                  { backgroundColor: colors.primaryBackground },
                ]}
              >
                <Ionicons name="person" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("profile.personalInfo")}
              </Text>
            </View>

            <View style={styles.infoList}>
              <View style={styles.infoRow}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={colors.textTertiary}
                />
                <View style={styles.infoContent}>
                  <Text
                    style={[styles.infoLabel, { color: colors.textTertiary }]}
                  >
                    {tc("labels.email")}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {displayUser.email}
                  </Text>
                </View>
              </View>

              <View
                style={[styles.infoDivider, { backgroundColor: colors.border }]}
              />

              <View style={styles.infoRow}>
                <Ionicons
                  name="call-outline"
                  size={18}
                  color={colors.textTertiary}
                />
                <View style={styles.infoContent}>
                  <Text
                    style={[styles.infoLabel, { color: colors.textTertiary }]}
                  >
                    {tc("labels.phone")}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {displayUser.phone}
                  </Text>
                </View>
              </View>

              <View
                style={[styles.infoDivider, { backgroundColor: colors.border }]}
              />

              <View style={styles.infoRow}>
                <Ionicons
                  name="medical-outline"
                  size={18}
                  color={colors.textTertiary}
                />
                <View style={styles.infoContent}>
                  <Text
                    style={[styles.infoLabel, { color: colors.textTertiary }]}
                  >
                    {t("profile.department")}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {displayUser.department}
                  </Text>
                </View>
              </View>

              <View
                style={[styles.infoDivider, { backgroundColor: colors.border }]}
              />

              <View style={styles.infoRow}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={colors.textTertiary}
                />
                <View style={styles.infoContent}>
                  <Text
                    style={[styles.infoLabel, { color: colors.textTertiary }]}
                  >
                    {t("profile.startDate")}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {displayUser.startDate}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </MotiView>

        {/* Organization */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 200 }}
        >
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={[
                  styles.sectionIcon,
                  { backgroundColor: colors.successBackground },
                ]}
              >
                <FontAwesome5
                  name="hospital"
                  size={16}
                  color={colors.success}
                />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("profile.organization")}
              </Text>
            </View>

            <View style={styles.orgCard}>
              <Text style={[styles.orgName, { color: colors.text }]}>
                {displayUser.organization.name}
              </Text>
              <Text
                style={[styles.orgAddress, { color: colors.textSecondary }]}
              >
                {displayUser.organization.address}
              </Text>
              <Text
                style={[styles.orgAddress, { color: colors.textSecondary }]}
              >
                {displayUser.organization.city}
              </Text>
            </View>

            <View
              style={[
                styles.workLocationCard,
                { backgroundColor: colors.backgroundSecondary },
              ]}
            >
              <View style={styles.workLocationHeader}>
                <Ionicons name="location" size={16} color={colors.primary} />
                <Text
                  style={[styles.workLocationTitle, { color: colors.text }]}
                >
                  {t("profile.workLocation")}
                </Text>
              </View>
              <Text
                style={[
                  styles.workLocationName,
                  { color: colors.textSecondary },
                ]}
              >
                {displayUser.workLocation.name}
              </Text>
              <View style={styles.workLocationRadius}>
                <MaterialCommunityIcons
                  name="map-marker-radius"
                  size={14}
                  color={colors.textTertiary}
                />
                <Text
                  style={[
                    styles.workLocationRadiusText,
                    { color: colors.textTertiary },
                  ]}
                >
                  {t("profile.geofence")}: {displayUser.workLocation.radius}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.managerCard,
                { backgroundColor: colors.backgroundSecondary },
              ]}
            >
              <View
                style={[styles.managerAvatar, { backgroundColor: colors.info }]}
              >
                <Text style={styles.managerInitials}>
                  {displayUser.manager.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </Text>
              </View>
              <View style={styles.managerInfo}>
                <Text
                  style={[styles.managerLabel, { color: colors.textTertiary }]}
                >
                  {t("profile.yourManager")}
                </Text>
                <Text style={[styles.managerName, { color: colors.text }]}>
                  {displayUser.manager.name}
                </Text>
                <Text
                  style={[styles.managerTitle, { color: colors.textSecondary }]}
                >
                  {displayUser.manager.title}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.contactBtn,
                  { backgroundColor: colors.primaryBackground },
                ]}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </Card>
        </MotiView>

        {/* Preferences */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 250 }}
        >
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={[
                  styles.sectionIcon,
                  { backgroundColor: colors.warningBackground },
                ]}
              >
                <Ionicons name="options" size={18} color={colors.warning} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("profile.preferences")}
              </Text>
            </View>

            {/* Theme */}
            <TouchableOpacity style={styles.settingRow} onPress={cycleTheme}>
              <View
                style={[
                  styles.settingIconBox,
                  { backgroundColor: colors.primaryBackground },
                ]}
              >
                <Ionicons
                  name={getThemeIcon()}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {t("appearance.title")}
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    { color: colors.textTertiary },
                  ]}
                >
                  {t("appearance.tapToChange")}
                </Text>
              </View>
              <View
                style={[
                  styles.themeBadge,
                  { backgroundColor: colors.backgroundTertiary },
                ]}
              >
                <Text
                  style={[
                    styles.themeBadgeText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {getThemeLabel()}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={colors.textTertiary}
                />
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.settingDivider,
                { backgroundColor: colors.border },
              ]}
            />

            {/* Biometric */}
            <View style={styles.settingRow}>
              <View
                style={[
                  styles.settingIconBox,
                  { backgroundColor: colors.successBackground },
                ]}
              >
                <MaterialCommunityIcons
                  name="fingerprint"
                  size={18}
                  color={colors.success}
                />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {t("security.biometricLogin")}
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    { color: colors.textTertiary },
                  ]}
                >
                  {t("security.biometricDescription")}
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View
              style={[
                styles.settingDivider,
                { backgroundColor: colors.border },
              ]}
            />

            {/* Notifications */}
            <View style={styles.settingRow}>
              <View
                style={[
                  styles.settingIconBox,
                  { backgroundColor: colors.errorBackground },
                ]}
              >
                <Ionicons name="notifications" size={18} color={colors.error} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {t("notifications.title")}
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    { color: colors.textTertiary },
                  ]}
                >
                  {t("notifications.pushAlerts")}
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={(value) => {
                  Haptics.selectionAsync();
                  setNotificationsEnabled(value);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View
              style={[
                styles.settingDivider,
                { backgroundColor: colors.border },
              ]}
            />

            {/* Location */}
            <View style={styles.settingRow}>
              <View
                style={[
                  styles.settingIconBox,
                  { backgroundColor: colors.infoBackground },
                ]}
              >
                <Ionicons name="location" size={18} color={colors.info} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {t("location.title")}
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    { color: colors.textTertiary },
                  ]}
                >
                  {t("location.requiredForClockIn")}
                </Text>
              </View>
              <Switch
                value={locationEnabled}
                onValueChange={(value) => {
                  Haptics.selectionAsync();
                  setLocationEnabled(value);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Card>
        </MotiView>

        {/* Support & Account */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 300 }}
        >
          <Card style={styles.section}>
            <TouchableOpacity style={styles.menuRow}>
              <View
                style={[
                  styles.settingIconBox,
                  { backgroundColor: colors.infoBackground },
                ]}
              >
                <Ionicons name="help-circle" size={18} color={colors.info} />
              </View>
              <Text style={[styles.menuLabel, { color: colors.text }]}>
                {t("support.helpSupport")}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textTertiary}
              />
            </TouchableOpacity>

            <View
              style={[
                styles.settingDivider,
                { backgroundColor: colors.border },
              ]}
            />

            <TouchableOpacity style={styles.menuRow}>
              <View
                style={[
                  styles.settingIconBox,
                  { backgroundColor: colors.backgroundTertiary },
                ]}
              >
                <Feather
                  name="file-text"
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
              <Text style={[styles.menuLabel, { color: colors.text }]}>
                {t("support.privacyPolicy")}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textTertiary}
              />
            </TouchableOpacity>

            <View
              style={[
                styles.settingDivider,
                { backgroundColor: colors.border },
              ]}
            />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={handleSignOut}
              disabled={isLoggingOut}
            >
              <View
                style={[
                  styles.settingIconBox,
                  { backgroundColor: colors.errorBackground },
                ]}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Ionicons name="log-out" size={18} color={colors.error} />
                )}
              </View>
              <Text style={[styles.menuLabel, { color: colors.error }]}>
                {isLoggingOut ? t("account.signingOut") : t("account.signOut")}
              </Text>
              {!isLoggingOut && (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.error}
                />
              )}
            </TouchableOpacity>
          </Card>
        </MotiView>

        {/* App Version */}
        <View style={styles.footer}>
          <Text style={[styles.versionText, { color: colors.textTertiary }]}>
            {t("about.version")}
          </Text>
          {/* <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            {t("about.tagline")}
          </Text> */}
        </View>
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
  settingsButton: {
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
    paddingBottom: 80,
  },
  profileCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  profileHeader: {
    position: "relative",
    marginBottom: 16,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  editAvatarBtn: {
    position: "absolute",
    bottom: 0,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  userPosition: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 12,
  },
  employeeIdBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 20,
  },
  employeeIdText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  profileStats: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  profileStatItem: {
    flex: 1,
    alignItems: "center",
  },
  profileStatValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  profileStatLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  profileStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  quickActionBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  infoList: {},
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "500",
  },
  infoDivider: {
    height: 1,
    marginLeft: 30,
  },
  orgCard: {
    marginBottom: 16,
  },
  orgName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  orgAddress: {
    fontSize: 14,
    lineHeight: 20,
  },
  workLocationCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  workLocationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  workLocationTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  workLocationName: {
    fontSize: 14,
    marginBottom: 6,
  },
  workLocationRadius: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  workLocationRadiusText: {
    fontSize: 12,
  },
  managerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
  },
  managerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  managerInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  managerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  managerLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  managerName: {
    fontSize: 15,
    fontWeight: "600",
  },
  managerTitle: {
    fontSize: 13,
    marginTop: 1,
  },
  contactBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  settingIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  settingDivider: {
    height: 1,
    marginLeft: 48,
  },
  themeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  themeBadgeText: {
    fontSize: 13,
    fontWeight: "500",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    marginLeft: 12,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  footerText: {
    fontSize: 12,
    marginTop: 4,
  },
});

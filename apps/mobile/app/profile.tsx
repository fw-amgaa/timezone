import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
  FontAwesome5,
} from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { Card, Button } from "@/components/ui";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();

  // Mock user data
  const user = {
    name: "Sarah Chen",
    email: "sarah.chen@centralhospital.com",
    phone: "+1 (555) 123-4567",
    employeeId: "EMP-2024-0892",
    department: "Emergency Medicine",
    position: "Senior Nurse",
    startDate: "March 15, 2022",
    avatarUrl: null,
    initials: "SC",
  };

  // Mock organization data
  const organization = {
    name: "Central Hospital",
    address: "123 Healthcare Ave, Medical District",
    city: "San Francisco, CA 94102",
    phone: "+1 (555) 000-1234",
    workLocation: {
      name: "Main Building - Emergency Dept",
      coordinates: "37.7749° N, 122.4194° W",
      radius: "500 meters",
    },
    manager: {
      name: "Dr. Michael Roberts",
      title: "Department Head",
      email: "m.roberts@centralhospital.com",
    },
  };

  // Mock stats
  const stats = {
    totalHoursThisMonth: 168,
    avgHoursPerDay: 8.4,
    daysWorkedThisMonth: 20,
    onTimeRate: 98,
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            // Handle logout
            router.replace("/");
          },
        },
      ]
    );
  };

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Profile
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/settings")}
          style={[
            styles.settingsButton,
            { backgroundColor: colors.backgroundTertiary },
          ]}
        >
          <Ionicons name="settings-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 15 }}
        >
          <View style={styles.profileHeader}>
            <View
              style={[
                styles.avatarContainer,
                { backgroundColor: colors.primary },
              ]}
            >
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
              ) : (
                <Text style={styles.avatarText}>{user.initials}</Text>
              )}
              <TouchableOpacity
                style={[
                  styles.editAvatarButton,
                  { backgroundColor: colors.background },
                ]}
              >
                <Feather name="camera" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.userName, { color: colors.text }]}>
              {user.name}
            </Text>
            <Text
              style={[styles.userPosition, { color: colors.textSecondary }]}
            >
              {user.position}
            </Text>

            <View
              style={[
                styles.employeeIdBadge,
                { backgroundColor: colors.primaryBackground },
              ]}
            >
              <Ionicons name="id-card" size={14} color={colors.primary} />
              <Text style={[styles.employeeIdText, { color: colors.primary }]}>
                {user.employeeId}
              </Text>
            </View>
          </View>
        </MotiView>

        {/* Quick Stats */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 100 }}
        >
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: colors.primaryBackground },
                ]}
              >
                <Feather name="clock" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.totalHoursThisMonth}h
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                This Month
              </Text>
            </Card>

            <Card style={styles.statCard}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: colors.successBackground },
                ]}
              >
                <Feather name="calendar" size={18} color={colors.success} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.daysWorkedThisMonth}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Days Worked
              </Text>
            </Card>

            <Card style={styles.statCard}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: colors.infoBackground },
                ]}
              >
                <MaterialCommunityIcons
                  name="percent"
                  size={18}
                  color={colors.info}
                />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.onTimeRate}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                On Time
              </Text>
            </Card>
          </View>
        </MotiView>

        {/* Personal Information */}
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
                  { backgroundColor: colors.primaryBackground },
                ]}
              >
                <Ionicons name="person" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Personal Information
              </Text>
            </View>

            <View style={styles.infoList}>
              <View style={styles.infoRow}>
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  Full Name
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {user.name}
                </Text>
              </View>

              <View
                style={[styles.infoDivider, { backgroundColor: colors.border }]}
              />

              <View style={styles.infoRow}>
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  Email
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {user.email}
                </Text>
              </View>

              <View
                style={[styles.infoDivider, { backgroundColor: colors.border }]}
              />

              <View style={styles.infoRow}>
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  Phone
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {user.phone}
                </Text>
              </View>

              <View
                style={[styles.infoDivider, { backgroundColor: colors.border }]}
              />

              <View style={styles.infoRow}>
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  Department
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {user.department}
                </Text>
              </View>

              <View
                style={[styles.infoDivider, { backgroundColor: colors.border }]}
              />

              <View style={styles.infoRow}>
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  Start Date
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {user.startDate}
                </Text>
              </View>
            </View>
          </Card>
        </MotiView>

        {/* Organization Information */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 300 }}
        >
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={[
                  styles.sectionIcon,
                  { backgroundColor: colors.successBackground },
                ]}
              >
                <Ionicons name="business" size={18} color={colors.success} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Organization
              </Text>
            </View>

            <View style={styles.orgHeader}>
              <View
                style={[
                  styles.orgLogo,
                  { backgroundColor: colors.backgroundTertiary },
                ]}
              >
                <FontAwesome5
                  name="hospital"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={styles.orgInfo}>
                <Text style={[styles.orgName, { color: colors.text }]}>
                  {organization.name}
                </Text>
                <Text
                  style={[styles.orgAddress, { color: colors.textSecondary }]}
                >
                  {organization.address}
                </Text>
                <Text
                  style={[styles.orgAddress, { color: colors.textSecondary }]}
                >
                  {organization.city}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.workLocationCard,
                { backgroundColor: colors.backgroundSecondary },
              ]}
            >
              <View style={styles.workLocationHeader}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <Text
                  style={[styles.workLocationTitle, { color: colors.text }]}
                >
                  Work Location
                </Text>
              </View>
              <Text style={[styles.workLocationName, { color: colors.text }]}>
                {organization.workLocation.name}
              </Text>
              <View style={styles.workLocationDetails}>
                <View style={styles.workLocationDetail}>
                  <Text
                    style={[
                      styles.workLocationLabel,
                      { color: colors.textTertiary },
                    ]}
                  >
                    Coordinates
                  </Text>
                  <Text
                    style={[
                      styles.workLocationValue,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {organization.workLocation.coordinates}
                  </Text>
                </View>
                <View style={styles.workLocationDetail}>
                  <Text
                    style={[
                      styles.workLocationLabel,
                      { color: colors.textTertiary },
                    ]}
                  >
                    Geofence Radius
                  </Text>
                  <Text
                    style={[
                      styles.workLocationValue,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {organization.workLocation.radius}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </MotiView>

        {/* Manager */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 400 }}
        >
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={[
                  styles.sectionIcon,
                  { backgroundColor: colors.infoBackground },
                ]}
              >
                <Ionicons name="people" size={18} color={colors.info} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Your Manager
              </Text>
            </View>

            <View style={styles.managerCard}>
              <View
                style={[styles.managerAvatar, { backgroundColor: colors.info }]}
              >
                <Text style={styles.managerInitials}>
                  {organization.manager.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </Text>
              </View>
              <View style={styles.managerInfo}>
                <Text style={[styles.managerName, { color: colors.text }]}>
                  {organization.manager.name}
                </Text>
                <Text
                  style={[styles.managerTitle, { color: colors.textSecondary }]}
                >
                  {organization.manager.title}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.contactButton,
                  { backgroundColor: colors.primaryBackground },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </Card>
        </MotiView>

        {/* Actions */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 500 }}
        >
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.backgroundTertiary },
              ]}
              onPress={() => router.push("/settings")}
            >
              <View style={styles.actionContent}>
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: colors.primaryBackground },
                  ]}
                >
                  <Ionicons
                    name="settings-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text style={[styles.actionText, { color: colors.text }]}>
                  Settings
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.backgroundTertiary },
              ]}
            >
              <View style={styles.actionContent}>
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: colors.infoBackground },
                  ]}
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={20}
                    color={colors.info}
                  />
                </View>
                <Text style={[styles.actionText, { color: colors.text }]}>
                  Help & Support
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.errorBackground },
              ]}
              onPress={handleLogout}
            >
              <View style={styles.actionContent}>
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: `${colors.error}20` },
                  ]}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={20}
                    color={colors.error}
                  />
                </View>
                <Text style={[styles.actionText, { color: colors.error }]}>
                  Sign Out
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </MotiView>

        <Text style={[styles.version, { color: colors.textTertiary }]}>
          TimeZone v1.0.0
        </Text>
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
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  userPosition: {
    fontSize: 16,
    marginBottom: 12,
  },
  employeeIdBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  employeeIdText: {
    fontSize: 13,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
  },
  infoDivider: {
    height: 1,
  },
  orgHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  orgLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  orgAddress: {
    fontSize: 13,
    lineHeight: 18,
  },
  workLocationCard: {
    padding: 16,
    borderRadius: 12,
  },
  workLocationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  workLocationTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  workLocationName: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 12,
  },
  workLocationDetails: {
    flexDirection: "row",
    gap: 24,
  },
  workLocationDetail: {},
  workLocationLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  workLocationValue: {
    fontSize: 13,
  },
  managerCard: {
    flexDirection: "row",
    alignItems: "center",
  },
  managerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  managerInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  managerInfo: {
    flex: 1,
  },
  managerName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  managerTitle: {
    fontSize: 13,
  },
  contactButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
  },
  actionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "500",
  },
  version: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 24,
  },
});

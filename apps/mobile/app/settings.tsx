import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import {
  Ionicons,
  MaterialCommunityIcons,
  Feather,
} from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { useLanguage, useTranslation } from "@/lib/i18n/context";
import { Locale } from "@/lib/i18n";
import { Card, Button } from "@/components/ui";

type ThemeOption = "light" | "dark" | "system";

export default function SettingsScreen() {
  const { colors, isDark, mode, setMode } = useTheme();
  const { locale, setLocale, localeNames, localeFlags, supportedLocales } = useLanguage();
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Notification settings
  const [notifications, setNotifications] = useState({
    clockReminders: true,
    approvalAlerts: true,
    scheduleChanges: true,
    weeklyReports: false,
  });

  // Location settings
  const [locationSettings, setLocationSettings] = useState({
    highAccuracy: true,
    backgroundLocation: true,
  });

  const handleThemeChange = (newMode: ThemeOption) => {
    Haptics.selectionAsync();
    setMode(newMode);
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(tc("status.error"), t("password.error.fillAll"));
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert(tc("status.error"), t("password.error.minLength"));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(tc("status.error"), t("password.error.mismatch"));
      return;
    }

    setIsChangingPassword(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Simulate API call
    setTimeout(() => {
      setIsChangingPassword(false);
      setShowPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(tc("status.success"), t("password.success"));
    }, 1500);
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    Haptics.selectionAsync();
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleLocationSetting = (key: keyof typeof locationSettings) => {
    Haptics.selectionAsync();
    setLocationSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLanguageChange = async (newLocale: Locale) => {
    Haptics.selectionAsync();
    await setLocale(newLocale);
  };

  const LanguageOptionButton = ({
    localeOption,
  }: {
    localeOption: Locale;
  }) => (
    <TouchableOpacity
      onPress={() => handleLanguageChange(localeOption)}
      style={[
        styles.themeOption,
        {
          backgroundColor: locale === localeOption ? colors.primaryBackground : colors.backgroundSecondary,
          borderColor: locale === localeOption ? colors.primary : colors.border,
          borderWidth: locale === localeOption ? 2 : 1,
        },
      ]}
    >
      <Text style={styles.languageFlag}>{localeFlags[localeOption]}</Text>
      <Text
        style={[
          styles.themeOptionText,
          { color: locale === localeOption ? colors.primary : colors.text },
        ]}
      >
        {localeNames[localeOption]}
      </Text>
      {locale === localeOption && (
        <View style={[styles.themeCheckmark, { backgroundColor: colors.primary }]}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );

  const ThemeOptionButton = ({
    option,
    label,
    icon,
  }: {
    option: ThemeOption;
    label: string;
    icon: string;
  }) => (
    <TouchableOpacity
      onPress={() => handleThemeChange(option)}
      style={[
        styles.themeOption,
        {
          backgroundColor: mode === option ? colors.primaryBackground : colors.backgroundSecondary,
          borderColor: mode === option ? colors.primary : colors.border,
          borderWidth: mode === option ? 2 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon as any}
        size={24}
        color={mode === option ? colors.primary : colors.textSecondary}
      />
      <Text
        style={[
          styles.themeOptionText,
          { color: mode === option ? colors.primary : colors.text },
        ]}
      >
        {label}
      </Text>
      {mode === option && (
        <View style={[styles.themeCheckmark, { backgroundColor: colors.primary }]}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300 }}
        >
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.primaryBackground }]}>
                <Ionicons name="color-palette" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("appearance.title")}
              </Text>
            </View>

            <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
              {t("appearance.description")}
            </Text>

            <View style={styles.themeOptions}>
              <ThemeOptionButton option="light" label={t("appearance.themes.light")} icon="sunny" />
              <ThemeOptionButton option="dark" label={t("appearance.themes.dark")} icon="moon" />
              <ThemeOptionButton option="system" label={t("appearance.themes.system")} icon="phone-portrait" />
            </View>
          </Card>
        </MotiView>

        {/* Language */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 50 }}
        >
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.infoBackground }]}>
                <Ionicons name="language" size={18} color={colors.info} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("language.title")}
              </Text>
            </View>

            <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
              {t("language.description")}
            </Text>

            <View style={styles.themeOptions}>
              {supportedLocales.map((loc) => (
                <LanguageOptionButton key={loc} localeOption={loc} />
              ))}
            </View>
          </Card>
        </MotiView>

        {/* Security */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 100 }}
        >
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.warningBackground }]}>
                <Ionicons name="shield-checkmark" size={18} color={colors.warning} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("security.title")}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setShowPasswordModal(true)}
            >
              <View style={styles.settingInfo}>
                <Feather name="lock" size={20} color={colors.textSecondary} />
                <View style={styles.settingText}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t("security.changePassword")}
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                    {t("security.changePasswordDesc")}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons name="fingerprint" size={20} color={colors.textSecondary} />
                <View style={styles.settingText}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t("security.biometricLogin")}
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                    {t("security.biometricDescription")}
                  </Text>
                </View>
              </View>
              <Switch
                value={true}
                onValueChange={() => Haptics.selectionAsync()}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </TouchableOpacity>
          </Card>
        </MotiView>

        {/* Notifications */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 200 }}
        >
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.errorBackground }]}>
                <Ionicons name="notifications" size={18} color={colors.error} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("notifications.title")}
              </Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="alarm" size={20} color={colors.textSecondary} />
                <View style={styles.settingText}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t("notifications.clockInReminders")}
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                    {t("notifications.clockInRemindersDesc")}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifications.clockReminders}
                onValueChange={() => toggleNotification("clockReminders")}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="checkmark-circle" size={20} color={colors.textSecondary} />
                <View style={styles.settingText}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t("notifications.approvalAlerts")}
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                    {t("notifications.approvalAlertsDesc")}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifications.approvalAlerts}
                onValueChange={() => toggleNotification("approvalAlerts")}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="calendar" size={20} color={colors.textSecondary} />
                <View style={styles.settingText}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t("notifications.scheduleChanges")}
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                    {t("notifications.scheduleChangesDesc")}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifications.scheduleChanges}
                onValueChange={() => toggleNotification("scheduleChanges")}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="stats-chart" size={20} color={colors.textSecondary} />
                <View style={styles.settingText}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t("notifications.weeklyReports")}
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                    {t("notifications.weeklyReportsDesc")}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifications.weeklyReports}
                onValueChange={() => toggleNotification("weeklyReports")}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Card>
        </MotiView>

        {/* Location */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 300 }}
        >
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.successBackground }]}>
                <Ionicons name="location" size={18} color={colors.success} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("location.title")}
              </Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons name="crosshairs-gps" size={20} color={colors.textSecondary} />
                <View style={styles.settingText}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t("location.highAccuracy")}
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                    {t("location.highAccuracyDesc")}
                  </Text>
                </View>
              </View>
              <Switch
                value={locationSettings.highAccuracy}
                onValueChange={() => toggleLocationSetting("highAccuracy")}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <MaterialCommunityIcons name="map-marker-radius" size={20} color={colors.textSecondary} />
                <View style={styles.settingText}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    {t("location.backgroundLocation")}
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                    {t("location.backgroundLocationDesc")}
                  </Text>
                </View>
              </View>
              <Switch
                value={locationSettings.backgroundLocation}
                onValueChange={() => toggleLocationSetting("backgroundLocation")}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.locationNotice, { backgroundColor: colors.infoBackground }]}>
              <Feather name="info" size={16} color={colors.info} />
              <Text style={[styles.locationNoticeText, { color: colors.infoDark }]}>
                {t("location.privacyNote")}
              </Text>
            </View>
          </Card>
        </MotiView>

        {/* About */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 400 }}
        >
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.infoBackground }]}>
                <Ionicons name="information-circle" size={18} color={colors.info} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("about.title")}
              </Text>
            </View>

            <TouchableOpacity style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Feather name="file-text" size={20} color={colors.textSecondary} />
                <Text style={[styles.settingLabel, { color: colors.text, marginLeft: 12 }]}>
                  {t("about.termsOfService")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Feather name="shield" size={20} color={colors.textSecondary} />
                <Text style={[styles.settingLabel, { color: colors.text, marginLeft: 12 }]}>
                  {t("about.privacyPolicy")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>

            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Feather name="info" size={20} color={colors.textSecondary} />
                <Text style={[styles.settingLabel, { color: colors.text, marginLeft: 12 }]}>
                  {t("about.version")}
                </Text>
              </View>
              <Text style={[styles.versionText, { color: colors.textTertiary }]}>
                1.0.0 (Build 100)
              </Text>
            </View>
          </Card>
        </MotiView>
      </ScrollView>

      {/* Password Change Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => setShowPasswordModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t("password.title")}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={styles.modalContentContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.passwordIcon, { backgroundColor: colors.warningBackground }]}>
                <Feather name="lock" size={32} color={colors.warning} />
              </View>

              <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
                {t("password.description")}
              </Text>

              {/* Current Password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t("password.currentPassword")}
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={t("password.currentPasswordPlaceholder")}
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showCurrentPassword}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showCurrentPassword ? "eye-off" : "eye"}
                      size={20}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* New Password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t("password.newPassword")}
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={t("password.newPasswordPlaceholder")}
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showNewPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showNewPassword ? "eye-off" : "eye"}
                      size={20}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.inputHint, { color: colors.textTertiary }]}>
                  {t("password.minLength")}
                </Text>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {t("password.confirmPassword")}
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={t("password.confirmPasswordPlaceholder")}
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={true}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                  />
                </View>
                {confirmPassword && newPassword !== confirmPassword && (
                  <Text style={[styles.inputError, { color: colors.error }]}>
                    {t("password.mismatch")}
                  </Text>
                )}
              </View>

              <Button
                size="xl"
                fullWidth
                loading={isChangingPassword}
                disabled={!currentPassword || !newPassword || !confirmPassword}
                onPress={handlePasswordChange}
              >
                {t("password.updateButton")}
              </Button>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
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
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  themeOptions: {
    flexDirection: "row",
    gap: 12,
  },
  themeOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    position: "relative",
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  themeCheckmark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
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
    marginLeft: 32,
  },
  locationNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 10,
  },
  locationNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  versionText: {
    fontSize: 14,
  },
  languageFlag: {
    fontSize: 24,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 20,
  },
  passwordIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  modalDescription: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  eyeButton: {
    padding: 4,
  },
  inputHint: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  inputError: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
});

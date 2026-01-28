import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/context";

export default function SetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const { verificationToken, firstName } = useLocalSearchParams<{
    verificationToken: string;
    firstName?: string;
  }>();
  const { setUser, enableBiometrics, setKeepLoggedIn } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [keepLoggedIn, setKeepLoggedInLocal] = useState(true);

  const passwordRequirements = [
    { label: t("setPassword.requirements.minLength"), met: password.length >= 8 },
    { label: t("setPassword.requirements.number"), met: /\d/.test(password) },
    { label: t("setPassword.requirements.uppercase"), met: /[A-Z]/.test(password) },
    { label: t("setPassword.requirements.lowercase"), met: /[a-z]/.test(password) },
  ];

  const allRequirementsMet = passwordRequirements.every((req) => req.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const isValid = allRequirementsMet && passwordsMatch;

  const handleSetPassword = async () => {
    if (!isValid) return;

    setIsLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const deviceInfo = {
        platform: Platform.OS,
        appVersion: "1.0.0",
      };

      const result = await api.setPassword(verificationToken || "", password, deviceInfo);

      if (!result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(tc("status.error"), result.error || t("errors.setPasswordFailed"));
        setIsLoading(false);
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (result.user) {
        setUser(result.user);
      }

      await setKeepLoggedIn(keepLoggedIn);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        Alert.alert(
          t("biometric.enableTitle"),
          t("biometric.enableMessage"),
          [
            {
              text: t("biometric.notNow"),
              style: "cancel",
              onPress: () => router.replace("/(tabs)"),
            },
            {
              text: t("biometric.enable"),
              onPress: async () => {
                const enabled = await enableBiometrics(password);
                if (enabled) {
                  await Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success
                  );
                }
                router.replace("/(tabs)");
              },
            },
          ]
        );
      } else {
        router.replace("/(tabs)");
      }
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(tc("status.error"), tc("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#312E81", "#4338CA", "#6366F1"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.content, { paddingTop: insets.top }]}>
            {/* Header */}
            <MotiView
              from={{ opacity: 0, translateY: -20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 600 }}
              style={styles.headerContainer}
            >
              <View style={styles.iconBox}>
                <Ionicons name="lock-closed-outline" size={32} color="white" />
              </View>
              <Text style={styles.headerTitle}>{t("setPassword.title")}</Text>
              <Text style={styles.headerSubtitle}>
                {firstName
                  ? t("setPassword.subtitleName", { name: firstName })
                  : t("setPassword.subtitle")}
              </Text>
            </MotiView>

            {/* Form */}
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 600, delay: 200 }}
              style={styles.formCard}
            >
              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t("setPassword.newPassword")}</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t("setPassword.newPasswordPlaceholder")}
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off" : "eye"}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Password Requirements */}
              <View style={styles.requirementsBox}>
                {passwordRequirements.map((req, index) => (
                  <View key={index} style={styles.requirementRow}>
                    <Ionicons
                      name={req.met ? "checkmark-circle" : "ellipse-outline"}
                      size={16}
                      color={req.met ? "#10B981" : "#9CA3AF"}
                    />
                    <Text
                      style={[
                        styles.requirementText,
                        req.met && styles.requirementTextMet,
                      ]}
                    >
                      {req.label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>{t("setPassword.confirmPassword")}</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={t("setPassword.confirmPasswordPlaceholder")}
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showConfirmPassword}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showConfirmPassword ? "eye-off" : "eye"}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <Text style={styles.errorText}>{t("setPassword.passwordMismatch")}</Text>
                )}
                {passwordsMatch && (
                  <View style={styles.matchRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    <Text style={styles.matchText}>{t("setPassword.passwordsMatch")}</Text>
                  </View>
                )}
              </View>

              {/* Keep Logged In */}
              <TouchableOpacity
                onPress={() => setKeepLoggedInLocal(!keepLoggedIn)}
                style={styles.checkboxRow}
              >
                <View
                  style={[
                    styles.checkbox,
                    keepLoggedIn && styles.checkboxChecked,
                  ]}
                >
                  {keepLoggedIn && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>{t("login.keepLoggedIn")}</Text>
              </TouchableOpacity>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSetPassword}
                disabled={!isValid || isLoading}
                style={[
                  styles.submitButton,
                  { backgroundColor: isValid && !isLoading ? "#6366F1" : "#D1D5DB" },
                ]}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitButtonText}>{t("register.createButton")}</Text>
                )}
              </TouchableOpacity>
            </MotiView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconBox: {
    width: 64,
    height: 64,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 24,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: "#111827",
  },
  eyeButton: {
    paddingHorizontal: 16,
  },
  requirementsBox: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  requirementText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#6B7280",
  },
  requirementTextMet: {
    color: "#10B981",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    marginTop: 8,
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  matchText: {
    color: "#10B981",
    fontSize: 14,
    marginLeft: 4,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  checkboxLabel: {
    color: "#374151",
    fontSize: 15,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});

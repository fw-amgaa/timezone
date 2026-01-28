import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
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

export default function PasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const { phone, firstName, lastName } = useLocalSearchParams<{
    phone: string;
    firstName?: string;
    lastName?: string;
  }>();
  const {
    setUser,
    enableBiometrics,
    setKeepLoggedIn,
    biometricsEnabled,
    biometricsAvailable,
    loginWithBiometrics,
  } = useAuth();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [keepLoggedIn, setKeepLoggedInLocal] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (biometricsEnabled && biometricsAvailable) {
      handleBiometricLogin();
    }
  }, []);

  const handleBiometricLogin = async () => {
    setIsLoading(true);
    const result = await loginWithBiometrics();

    if (result.success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } else {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!password) return;

    setIsLoading(true);
    setError(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const deviceInfo = {
        platform: Platform.OS,
        appVersion: "1.0.0",
      };

      const result = await api.login(phone || "", password, deviceInfo);

      if (!result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(result.error || "Invalid password");
        setIsLoading(false);
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (result.user) {
        setUser(result.user);
      }

      await setKeepLoggedIn(keepLoggedIn);

      if (!biometricsEnabled) {
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
          return;
        }
      }

      router.replace("/(tabs)");
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(tc("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Alert.alert(
      t("resetPassword.title"),
      t("resetPassword.sendCodeMessage"),
      [
        { text: tc("buttons.cancel"), style: "cancel" },
        {
          text: t("resetPassword.sendCode"),
          onPress: async () => {
            setIsLoading(true);
            const result = await api.sendOtp(phone || "");
            setIsLoading(false);

            if (result.success) {
              router.push({
                pathname: "/(auth)/verify",
                params: {
                  phone: phone,
                  isForgotPassword: "true",
                },
              });
            } else {
              Alert.alert(tc("status.error"), result.error || t("errors.sendCodeFailed"));
            }
          },
        },
      ]
    );
  };

  const formatPhone = (phoneNumber: string) => {
    if (phoneNumber.length === 10) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
    }
    return phoneNumber;
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
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { top: insets.top + 16 }]}
        >
          <View style={styles.backButtonInner}>
            <Ionicons name="arrow-back" size={20} color="white" />
          </View>
        </TouchableOpacity>

        <View style={[styles.content, { paddingTop: insets.top }]}>
          {/* Header */}
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 600 }}
            style={styles.headerContainer}
          >
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>
                {firstName?.charAt(0) || "?"}
                {lastName?.charAt(0) || ""}
              </Text>
            </View>
            <Text style={styles.headerTitle}>
              {firstName ? t("login.welcomeBack", { name: firstName }) : t("login.subtitle")}
            </Text>
            <Text style={styles.headerSubtitle}>+1 {formatPhone(phone || "")}</Text>
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
              <Text style={styles.inputLabel}>{t("login.password")}</Text>
              <View style={[styles.inputRow, error && styles.inputRowError]}>
                <TextInput
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  placeholder={t("login.passwordPlaceholder")}
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  autoCapitalize="none"
                  autoFocus
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
              {error && <Text style={styles.errorText}>{error}</Text>}
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
              onPress={handleLogin}
              disabled={!password || isLoading}
              style={[
                styles.submitButton,
                { backgroundColor: password && !isLoading ? "#6366F1" : "#D1D5DB" },
              ]}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitButtonText}>{t("login.loginButton")}</Text>
              )}
            </TouchableOpacity>

            {/* Biometric Login */}
            {biometricsEnabled && biometricsAvailable && (
              <TouchableOpacity
                onPress={handleBiometricLogin}
                disabled={isLoading}
                style={styles.biometricButton}
                activeOpacity={0.8}
              >
                <Ionicons name="finger-print" size={24} color="#6366F1" />
                <Text style={styles.biometricButtonText}>{t("biometric.authenticate")}</Text>
              </TouchableOpacity>
            )}

            {/* Forgot Password */}
            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotButton}>
              <Text style={styles.forgotButtonText}>{t("login.forgotPassword")}</Text>
            </TouchableOpacity>
          </MotiView>
        </View>
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
  backButton: {
    position: "absolute",
    left: 24,
    zIndex: 10,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  avatarBox: {
    width: 80,
    height: 80,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "700",
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
  inputRowError: {
    borderColor: "#F87171",
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
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    marginTop: 8,
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
  biometricButton: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#6366F1",
  },
  biometricButtonText: {
    color: "#6366F1",
    fontSize: 17,
    fontWeight: "700",
    marginLeft: 8,
  },
  forgotButton: {
    marginTop: 16,
    alignItems: "center",
  },
  forgotButtonText: {
    color: "#6366F1",
    fontSize: 15,
    fontWeight: "600",
  },
});

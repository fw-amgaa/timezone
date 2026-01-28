import { useState, useRef } from "react";
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
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/context";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const { biometricsEnabled, biometricsAvailable, loginWithBiometrics } =
    useAuth();
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const phoneInputRef = useRef<TextInput>(null);

  const handlePhoneChange = (text: string) => {
    setPhone(text);
  };

  const handleContinue = async () => {
    if (phone.length < 8) return;

    setIsLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const checkResult = await api.checkPhone(phone);

      if (!checkResult.success) {
        Alert.alert(
          tc("status.error"),
          checkResult.error || t("errors.checkPhoneFailed")
        );
        setIsLoading(false);
        return;
      }

      if (!checkResult.exists) {
        Alert.alert(
          t("errors.accountNotFound"),
          t("errors.accountNotFoundMessage")
        );
        setIsLoading(false);
        return;
      }

      if (checkResult.hasPassword) {
        router.push({
          pathname: "/(auth)/password",
          params: {
            phone: phone,
            firstName: checkResult.user?.firstName || "",
            lastName: checkResult.user?.lastName || "",
          },
        });
      } else {
        const otpResult = await api.sendOtp(phone);

        if (!otpResult.success) {
          Alert.alert(
            tc("status.error"),
            otpResult.error || t("errors.sendCodeFailed")
          );
          setIsLoading(false);
          return;
        }

        router.push({
          pathname: "/(auth)/verify",
          params: {
            phone: phone,
            isFirstTime: "true",
            firstName: checkResult.user?.firstName || "",
          },
        });
      }
    } catch (error) {
      Alert.alert(tc("status.error"), tc("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setIsBiometricLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await loginWithBiometrics();

    if (result.success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        t("errors.loginFailed"),
        result.error || t("biometric.failed")
      );
    }

    setIsBiometricLoading(false);
  };

  const isValidPhone = phone.length >= 8;

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
        <View style={[styles.content, { paddingTop: insets.top }]}>
          {/* Logo */}
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 600 }}
            style={styles.logoContainer}
          >
            <View style={styles.logoBox}>
              <Ionicons name="time" size={40} color="white" />
            </View>
            <Text style={styles.logoTitle}>TimeZone</Text>
            {/* <Text style={styles.logoSubtitle}>{tc("app.tagline")}</Text> */}
          </MotiView>

          {/* Form */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 600, delay: 200 }}
            style={styles.formCard}
          >
            <Text style={styles.formTitle}>{t("login.subtitle")}</Text>
            <Text style={styles.formSubtitle}>{t("login.description")}</Text>

            {/* Phone Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t("login.phone")}</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>+976</Text>
                </View>
                <TextInput
                  ref={phoneInputRef}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  placeholder="99123456"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  style={styles.phoneInput}
                  maxLength={8}
                  autoFocus
                />
                {phone.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setPhone("")}
                    style={styles.clearButton}
                  >
                    <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleContinue}
              disabled={!isValidPhone || isLoading}
              style={[
                styles.submitButton,
                {
                  backgroundColor:
                    isValidPhone && !isLoading ? "#6366F1" : "#D1D5DB",
                },
              ]}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {t("login.continueButton")}
                </Text>
              )}
            </TouchableOpacity>

            {/* Biometric Login */}
            {biometricsEnabled && biometricsAvailable && (
              <TouchableOpacity
                onPress={handleBiometricLogin}
                disabled={isBiometricLoading}
                style={styles.biometricButton}
                activeOpacity={0.8}
              >
                {isBiometricLoading ? (
                  <ActivityIndicator color="#6366F1" />
                ) : (
                  <>
                    <Ionicons name="finger-print" size={24} color="#6366F1" />
                    <Text style={styles.biometricButtonText}>
                      {t("login.biometricLogin")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Terms */}
            <Text style={styles.termsText}>
              {t("terms.prefix")}{" "}
              <Text style={styles.termsLink}>{t("terms.termsOfService")}</Text>{" "}
              {t("terms.and")}{" "}
              <Text style={styles.termsLink}>{t("terms.privacyPolicy")}</Text>
              {t("terms.suffix")}
            </Text>
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
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoBox: {
    width: 80,
    height: 80,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "700",
  },
  logoSubtitle: {
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
  formTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  formSubtitle: {
    color: "#6B7280",
    fontSize: 15,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
  },
  countryCode: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#F9FAFB",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  countryCodeText: {
    color: "#4B5563",
    fontSize: 16,
    fontWeight: "600",
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: "#111827",
  },
  clearButton: {
    paddingHorizontal: 16,
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
  termsText: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 18,
  },
  termsLink: {
    color: "#6366F1",
  },
});

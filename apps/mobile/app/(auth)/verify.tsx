import { useState, useRef, useEffect } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useTranslation } from "@/lib/i18n/context";

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const { phone, isFirstTime, firstName, isForgotPassword } =
    useLocalSearchParams<{
      phone: string;
      isFirstTime?: string;
      firstName?: string;
      isForgotPassword?: string;
    }>();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleCodeChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(cleaned);
    setError(null);

    if (cleaned.length === CODE_LENGTH) {
      handleVerify(cleaned);
    }
  };

  const handleVerify = async (verificationCode: string) => {
    setIsLoading(true);
    setError(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await api.verifyOtp(phone || "", verificationCode);

      if (!result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(result.error || "Invalid code");
        setCode("");
        setIsLoading(false);
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (isFirstTime === "true") {
        router.replace({
          pathname: "/(auth)/set-password",
          params: {
            verificationToken: result.verificationToken,
            firstName: firstName || "",
          },
        });
      } else if (isForgotPassword === "true") {
        router.replace({
          pathname: "/(auth)/reset-password",
          params: {
            verificationToken: result.verificationToken,
          },
        });
      } else {
        router.replace("/(tabs)");
      }
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("Something went wrong. Please try again.");
      setCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (timeLeft > 0) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await api.sendOtp(phone || "");

      if (result.success) {
        setTimeLeft(60);
        setError(null);
        Alert.alert(t("verify.codeSent"), t("verify.codeSentMessage"));
      } else {
        Alert.alert(
          tc("status.error"),
          result.error || t("errors.sendCodeFailed")
        );
      }
    } catch {
      Alert.alert(tc("status.error"), t("errors.sendCodeFailed"));
    }
  };

  const formatPhone = (phoneNumber: string) => {
    if (phoneNumber.length === 10) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(
        3,
        6
      )}-${phoneNumber.slice(6)}`;
    }
    return phoneNumber;
  };

  const getHeaderText = () => {
    if (isFirstTime === "true") {
      return firstName
        ? t("verify.welcomeName", { name: firstName })
        : t("verify.welcome");
    }
    if (isForgotPassword === "true") {
      return t("resetPassword.title");
    }
    return t("verify.title");
  };

  const getSubText = () => {
    if (isFirstTime === "true") {
      return t("verify.firstTimeMessage");
    }
    if (isForgotPassword === "true") {
      return t("verify.resetPasswordMessage");
    }
    return t("verify.enterCode");
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
            <View style={styles.iconBox}>
              <Ionicons name="chatbubble-outline" size={32} color="white" />
            </View>
            <Text style={styles.headerTitle}>{getHeaderText()}</Text>
            <Text style={styles.headerSubtitle}>
              {getSubText()}
              {"\n"}
              <Text style={styles.phoneNumber}>
                +976 {formatPhone(phone || "")}
              </Text>
            </Text>
          </MotiView>

          {/* Code Input */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 600, delay: 200 }}
            style={styles.formCard}
          >
            {/* Hidden TextInput */}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={handleCodeChange}
              keyboardType="number-pad"
              style={styles.hiddenInput}
              maxLength={CODE_LENGTH}
              autoFocus
              editable={!isLoading}
            />

            {/* Code Boxes */}
            <TouchableOpacity
              onPress={() => inputRef.current?.focus()}
              activeOpacity={1}
              style={styles.codeBoxes}
            >
              {Array.from({ length: CODE_LENGTH }).map((_, index) => {
                const digit = code[index];
                const isActive = index === code.length;
                const isFilled = index < code.length;

                return (
                  <MotiView
                    key={index}
                    animate={{
                      scale: isActive ? 1.05 : 1,
                      borderColor: error
                        ? "#EF4444"
                        : isActive
                        ? "#6366F1"
                        : isFilled
                        ? "#10B981"
                        : "#E5E7EB",
                    }}
                    transition={{ type: "timing", duration: 150 }}
                    style={styles.codeBox}
                  >
                    <Text style={styles.codeDigit}>{digit || ""}</Text>
                    {isActive && !isLoading && (
                      <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          loop: true,
                          type: "timing",
                          duration: 500,
                          repeatReverse: true,
                        }}
                        style={styles.cursor}
                      />
                    )}
                  </MotiView>
                );
              })}
            </TouchableOpacity>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Loading State */}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.loadingText}>{t("verify.verifying")}</Text>
              </View>
            )}

            {/* Resend */}
            <View style={styles.resendContainer}>
              {timeLeft > 0 ? (
                <Text style={styles.resendTimer}>
                  {t("verify.resendIn")}{" "}
                  <Text style={styles.resendTimerBold}>{timeLeft}s</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResend}>
                  <Text style={styles.resendButton}>
                    {t("verify.resendCode")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
  phoneNumber: {
    color: "#FFFFFF",
    fontWeight: "600",
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
  hiddenInput: {
    position: "absolute",
    opacity: 0,
  },
  codeBoxes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  codeBox: {
    width: 40,
    height: 48,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  codeDigit: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  cursor: {
    position: "absolute",
    bottom: 8,
    width: 20,
    height: 2,
    backgroundColor: "#6366F1",
    borderRadius: 1,
  },
  errorContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
  },
  errorText: {
    color: "#DC2626",
    textAlign: "center",
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  loadingText: {
    color: "#6B7280",
    marginTop: 8,
    fontSize: 14,
  },
  resendContainer: {
    alignItems: "center",
  },
  resendTimer: {
    color: "#6B7280",
    fontSize: 14,
  },
  resendTimerBold: {
    fontWeight: "700",
    color: "#374151",
  },
  resendButton: {
    color: "#6366F1",
    fontWeight: "700",
    fontSize: 14,
  },
});

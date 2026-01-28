import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { Button, Card } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type RequestStep = "info" | "camera" | "review";

export default function OutOfRangeRequestScreen() {
  const { colors } = useTheme();
  useAuth(); // Ensure authenticated
  const { t } = useTranslation("clock");
  const { t: tc } = useTranslation("common");
  const [step, setStep] = useState<RequestStep>("info");
  const [explanation, setExplanation] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [requestType, setRequestType] = useState<"clock_in" | "clock_out">(
    "clock_in"
  );
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // Historical request state
  const [isHistoricalRequest, setIsHistoricalRequest] = useState(false);
  const [historicalDate, setHistoricalDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Location info for display
  const [locationInfo, setLocationInfo] = useState({
    currentDistance: 0,
    requiredRadius: 0.2,
    workLocation: "Loading...",
    currentLocation: "Getting location...",
  });

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    await Promise.all([getLocation(), determineRequestType()]);
  };

  const determineRequestType = async () => {
    try {
      const result = await api.getCurrentShift();
      if (result.success && result.shift && result.shift.status === "open") {
        setRequestType("clock_out");
      } else {
        setRequestType("clock_in");
      }
    } catch {
      setRequestType("clock_in");
    }
  };

  const getLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("request.alerts.locationRequired"),
          t("request.alerts.locationRequiredMessage"),
          [{ text: tc("buttons.ok"), onPress: () => router.back() }]
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setCurrentLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy || 0,
      });

      // Reverse geocode to get address
      const [address] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      const addressString = address
        ? `${address.street || ""} ${address.city || ""}, ${
            address.region || ""
          }`.trim()
        : `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(
            4
          )}`;

      setLocationInfo((prev) => ({
        ...prev,
        currentLocation: addressString || "Current Location",
        workLocation: "Work Location", // Would come from user's org
      }));
    } catch (error) {
      Alert.alert(tc("status.error"), t("request.alerts.locationError"));
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleTakePhoto = async () => {
    if (cameraRef.current) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      if (result?.uri) {
        setPhoto(result.uri);
        setStep("review");
      }
    }
  };

  const handleRetakePhoto = () => {
    setPhoto(null);
    setStep("camera");
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(historicalDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setHistoricalDate(newDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(historicalDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setHistoricalDate(newDate);
    }
  };

  const handleSubmitRequest = async () => {
    if (!explanation.trim() || explanation.trim().length < 10) {
      Alert.alert(
        tc("status.required"),
        t("request.alerts.explanationRequired")
      );
      return;
    }

    // Photo not required for historical requests
    if (!isHistoricalRequest && !photo) {
      Alert.alert(tc("status.required"), t("request.alerts.photoRequired"));
      return;
    }

    if (!currentLocation) {
      Alert.alert(tc("status.error"), t("request.alerts.locationUnavailable"));
      return;
    }

    // Validate historical date is in the past
    if (isHistoricalRequest) {
      const now = new Date();
      if (historicalDate >= now) {
        Alert.alert(t("request.alerts.invalidDate"), t("request.historical.mustBePast"));
        return;
      }

      // Check if it's not too far in the past (e.g., 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (historicalDate < thirtyDaysAgo) {
        Alert.alert(
          t("request.alerts.invalidDate"),
          t("request.historical.maxDays")
        );
        return;
      }
    }

    setIsSubmitting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const requestTimestamp = isHistoricalRequest
        ? historicalDate.toISOString()
        : new Date().toISOString();

      const result = await api.submitCheckInRequest({
        location: {
          ...currentLocation,
          timestamp: requestTimestamp,
        },
        reason: explanation.trim(),
        photoUri: photo || undefined,
        // Pass historical flag and custom type if needed
        requestType: requestType,
        isHistorical: isHistoricalRequest,
        requestedTime: isHistoricalRequest ? requestTimestamp : undefined,
      });

      if (result.success) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        const typeText = requestType === "clock_in"
          ? t("buttons.clockIn").toLowerCase()
          : t("buttons.clockOut").toLowerCase();
        Alert.alert(
          t("request.successTitle"),
          isHistoricalRequest
            ? t("request.successDescriptionHistorical", { type: typeText })
            : t("request.successDescription", { type: typeText }),
          [{ text: tc("buttons.ok"), onPress: () => router.back() }]
        );
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          tc("status.error"),
          result.error || t("request.alerts.submitError")
        );
      }
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(tc("status.error"), t("request.alerts.genericError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Camera permission handling
  if (step === "camera" && !permission?.granted) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.permissionContainer}>
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 15 }}
          >
            <View
              style={[
                styles.permissionIcon,
                { backgroundColor: colors.primaryBackground },
              ]}
            >
              <Ionicons name="camera" size={48} color={colors.primary} />
            </View>
          </MotiView>
          <Text style={[styles.permissionTitle, { color: colors.text }]}>
            {t("request.camera.permissionTitle")}
          </Text>
          <Text
            style={[styles.permissionText, { color: colors.textSecondary }]}
          >
            {t("request.camera.permissionDescription")}
          </Text>
          <Button onPress={requestPermission} size="lg" fullWidth>
            {t("request.camera.grantAccess")}
          </Button>
          <Button
            variant="ghost"
            onPress={() => router.back()}
          >
            {t("request.camera.goBack")}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Camera view
  if (step === "camera") {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
          {/* Camera overlay */}
          <SafeAreaView style={styles.cameraOverlay}>
            {/* Top bar */}
            <View style={styles.cameraTopBar}>
              <TouchableOpacity
                onPress={() => setStep("info")}
                style={styles.cameraBackButton}
              >
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.cameraTitle}>{t("request.camera.title")}</Text>
              <TouchableOpacity
                onPress={toggleCameraFacing}
                style={styles.cameraFlipButton}
              >
                <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Guide frame */}
            <View style={styles.cameraGuideContainer}>
              <View style={styles.cameraGuide}>
                <View style={[styles.cornerTL, styles.corner]} />
                <View style={[styles.cornerTR, styles.corner]} />
                <View style={[styles.cornerBL, styles.corner]} />
                <View style={[styles.cornerBR, styles.corner]} />
              </View>
              <Text style={styles.cameraGuideText}>
                {t("request.camera.guideText")}
              </Text>
            </View>

            {/* Bottom controls */}
            <View style={styles.cameraBottomBar}>
              <View style={styles.captureButtonContainer}>
                <TouchableOpacity
                  onPress={handleTakePhoto}
                  style={styles.captureButton}
                >
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
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
            {isHistoricalRequest ? t("request.historical.title") + " " : ""}
            {requestType === "clock_in" ? t("request.clockInRequest") : t("request.clockOutRequest")}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Request Mode Toggle */}
          <MotiView
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 300 }}
          >
            <Card style={{ marginBottom: 20 }}>
              <View style={styles.modeToggleRow}>
                <View style={styles.modeToggleInfo}>
                  <Ionicons
                    name="time-outline"
                    size={24}
                    color={isHistoricalRequest ? colors.primary : colors.textSecondary}
                  />
                  <View style={styles.modeToggleText}>
                    <Text style={[styles.modeToggleTitle, { color: colors.text }]}>
                      {t("request.historical.toggle")}
                    </Text>
                    <Text
                      style={[
                        styles.modeToggleSubtitle,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t("request.historical.toggleDescription")}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isHistoricalRequest}
                  onValueChange={setIsHistoricalRequest}
                  trackColor={{ false: colors.border, true: colors.primaryLight }}
                  thumbColor={isHistoricalRequest ? colors.primary : colors.textTertiary}
                />
              </View>
            </Card>
          </MotiView>

          {/* Request Type Selector (for historical) */}
          {isHistoricalRequest && (
            <MotiView
              from={{ opacity: 0, translateY: -10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 300, delay: 50 }}
            >
              <Card style={{ marginBottom: 20 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("request.type")}
                </Text>
                <View style={styles.requestTypeRow}>
                  <TouchableOpacity
                    onPress={() => setRequestType("clock_in")}
                    style={[
                      styles.requestTypeButton,
                      {
                        backgroundColor:
                          requestType === "clock_in"
                            ? colors.primaryBackground
                            : colors.backgroundSecondary,
                        borderColor:
                          requestType === "clock_in"
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="log-in"
                      size={20}
                      color={
                        requestType === "clock_in"
                          ? colors.primary
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.requestTypeText,
                        {
                          color:
                            requestType === "clock_in"
                              ? colors.primary
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {t("buttons.clockIn")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setRequestType("clock_out")}
                    style={[
                      styles.requestTypeButton,
                      {
                        backgroundColor:
                          requestType === "clock_out"
                            ? colors.warningBackground
                            : colors.backgroundSecondary,
                        borderColor:
                          requestType === "clock_out"
                            ? colors.warning
                            : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="log-out"
                      size={20}
                      color={
                        requestType === "clock_out"
                          ? colors.warning
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.requestTypeText,
                        {
                          color:
                            requestType === "clock_out"
                              ? colors.warning
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {t("buttons.clockOut")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            </MotiView>
          )}

          {/* Historical Date/Time Picker */}
          {isHistoricalRequest && (
            <MotiView
              from={{ opacity: 0, translateY: -10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 300, delay: 100 }}
            >
              <Card style={{ marginBottom: 20 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t("request.historical.dateTime")} <Text style={{ color: colors.error }}>*</Text>
                </Text>
                <Text
                  style={[
                    styles.sectionDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("request.historical.dateTimeDescription")}
                </Text>

                <View style={styles.dateTimeRow}>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={[
                      styles.dateTimeButton,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={[styles.dateTimeText, { color: colors.text }]}>
                      {formatDate(historicalDate)}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowTimePicker(true)}
                    style={[
                      styles.dateTimeButton,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={[styles.dateTimeText, { color: colors.text }]}>
                      {formatTime(historicalDate)}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showDatePicker && (
                  <DateTimePicker
                    value={historicalDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                    minimumDate={(() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 30);
                      return d;
                    })()}
                  />
                )}

                {showTimePicker && (
                  <DateTimePicker
                    value={historicalDate}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleTimeChange}
                  />
                )}
              </Card>
            </MotiView>
          )}

          {/* Request Type Banner (for current requests) */}
          {!isHistoricalRequest && (
            <MotiView
              from={{ opacity: 0, translateY: -10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 300, delay: 100 }}
            >
              <View
                style={[
                  styles.warningBanner,
                  {
                    backgroundColor:
                      requestType === "clock_in"
                        ? colors.primaryBackground
                        : colors.warningBackground,
                  },
                ]}
              >
                <Ionicons
                  name={requestType === "clock_in" ? "log-in" : "log-out"}
                  size={24}
                  color={
                    requestType === "clock_in" ? colors.primary : colors.warning
                  }
                />
                <View style={styles.warningContent}>
                  <Text
                    style={[
                      styles.warningTitle,
                      {
                        color:
                          requestType === "clock_in"
                            ? colors.primary
                            : colors.warningDark,
                      },
                    ]}
                  >
                    {requestType === "clock_in"
                      ? t("request.banner.clockInTitle")
                      : t("request.banner.clockOutTitle")}
                  </Text>
                  <Text
                    style={[
                      styles.warningText,
                      {
                        color:
                          requestType === "clock_in"
                            ? colors.primary
                            : colors.warningDark,
                        opacity: 0.8,
                      },
                    ]}
                  >
                    {requestType === "clock_in"
                      ? t("request.banner.clockInDescription")
                      : t("request.banner.clockOutDescription")}
                  </Text>
                </View>
              </View>
            </MotiView>
          )}

          {/* Location Details Card */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 300, delay: 150 }}
          >
            <Card style={{ marginBottom: 20 }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("request.location.title")}
              </Text>

              <View style={styles.locationRow}>
                <View
                  style={[
                    styles.locationIcon,
                    { backgroundColor: colors.successBackground },
                  ]}
                >
                  <Ionicons name="business" size={18} color={colors.success} />
                </View>
                <View style={styles.locationInfo}>
                  <Text
                    style={[
                      styles.locationLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t("request.location.workLocation")}
                  </Text>
                  <Text style={[styles.locationValue, { color: colors.text }]}>
                    {locationInfo.workLocation}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.locationDivider,
                  { backgroundColor: colors.border },
                ]}
              />

              <View style={styles.locationRow}>
                <View
                  style={[
                    styles.locationIcon,
                    { backgroundColor: colors.errorBackground },
                  ]}
                >
                  <Ionicons name="navigate" size={18} color={colors.error} />
                </View>
                <View style={styles.locationInfo}>
                  <Text
                    style={[
                      styles.locationLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t("request.location.currentLocation")}
                  </Text>
                  {isLoadingLocation ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text
                        style={[
                          styles.locationValue,
                          { color: colors.textTertiary },
                        ]}
                      >
                        {t("request.location.gettingLocation")}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={[styles.locationValue, { color: colors.text }]}
                    >
                      {locationInfo.currentLocation}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          </MotiView>

          {/* Explanation Input */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 300, delay: 200 }}
          >
            <Card style={{ marginBottom: 20 }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("request.reason")} <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <Text
                style={[
                  styles.sectionDescription,
                  { color: colors.textSecondary },
                ]}
              >
                {isHistoricalRequest
                  ? t("request.reasonDescriptionHistorical")
                  : t("request.reasonDescription")}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder={
                  isHistoricalRequest
                    ? t("request.reasonPlaceholderHistorical")
                    : t("request.reasonPlaceholderCurrent")
                }
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={explanation}
                onChangeText={setExplanation}
                maxLength={500}
              />
              <Text style={[styles.charCount, { color: colors.textTertiary }]}>
                {explanation.length}/500
              </Text>
            </Card>
          </MotiView>

          {/* Photo Section (optional for historical) */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 300, delay: 300 }}
          >
            <Card style={{ marginBottom: 20 }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("request.photo")}{" "}
                {!isHistoricalRequest && (
                  <Text style={{ color: colors.error }}>*</Text>
                )}
                {isHistoricalRequest && (
                  <Text style={[styles.optionalTag, { color: colors.textTertiary }]}>
                    {t("request.photoOptional")}
                  </Text>
                )}
              </Text>
              <Text
                style={[
                  styles.sectionDescription,
                  { color: colors.textSecondary },
                ]}
              >
                {isHistoricalRequest
                  ? t("request.photoDescriptionHistorical")
                  : t("request.photoDescription")}
              </Text>

              {step === "review" && photo ? (
                <View style={styles.photoPreviewContainer}>
                  <Image source={{ uri: photo }} style={styles.photoPreview} />
                  <View style={styles.photoOverlay}>
                    <TouchableOpacity
                      onPress={handleRetakePhoto}
                      style={[
                        styles.retakeButton,
                        { backgroundColor: colors.background },
                      ]}
                    >
                      <Ionicons name="camera" size={20} color={colors.text} />
                      <Text style={[styles.retakeText, { color: colors.text }]}>
                        {t("request.retake")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View
                    style={[
                      styles.photoCheckmark,
                      { backgroundColor: colors.success },
                    ]}
                  >
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setStep("camera")}
                  style={[
                    styles.cameraButton,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.cameraIconContainer,
                      { backgroundColor: colors.primaryBackground },
                    ]}
                  >
                    <Ionicons name="camera" size={32} color={colors.primary} />
                  </View>
                  <Text
                    style={[styles.cameraButtonTitle, { color: colors.text }]}
                  >
                    {t("request.openCamera")}
                  </Text>
                  <Text
                    style={[
                      styles.cameraButtonSubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t("request.tapToTakePhoto")}
                  </Text>
                </TouchableOpacity>
              )}

              {!isHistoricalRequest && (
                <View
                  style={[
                    styles.photoNotice,
                    { backgroundColor: colors.infoBackground },
                  ]}
                >
                  <Feather name="info" size={16} color={colors.info} />
                  <Text
                    style={[styles.photoNoticeText, { color: colors.infoDark }]}
                  >
                    {t("request.photoNotice")}
                  </Text>
                </View>
              )}
            </Card>
          </MotiView>

          {/* Submit Button */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 300, delay: 400 }}
          >
            <Button
              size="xl"
              fullWidth
              loading={isSubmitting}
              disabled={
                !explanation.trim() ||
                (!isHistoricalRequest && !photo)
              }
              onPress={handleSubmitRequest}
              icon={<Ionicons name="send" size={20} color="#FFFFFF" />}
            >
              {t("request.submitButton")}
            </Button>
          </MotiView>

          <Text style={[styles.footerNote, { color: colors.textTertiary }]}>
            {t("request.footerNote")}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
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
  },
  modeToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modeToggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 16,
  },
  modeToggleText: {
    marginLeft: 12,
    flex: 1,
  },
  modeToggleTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  modeToggleSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  requestTypeRow: {
    flexDirection: "row",
    gap: 12,
  },
  requestTypeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  requestTypeText: {
    fontSize: 15,
    fontWeight: "600",
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  dateTimeText: {
    fontSize: 14,
    fontWeight: "500",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  warningContent: {
    marginLeft: 12,
    flex: 1,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  warningText: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  optionalTag: {
    fontSize: 14,
    fontWeight: "400",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  locationInfo: {
    marginLeft: 12,
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  locationValue: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: 2,
  },
  locationDivider: {
    height: 1,
    marginVertical: 12,
    marginLeft: 52,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 8,
  },
  cameraButton: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cameraButtonTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  cameraButtonSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  photoPreviewContainer: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
  },
  photoPreview: {
    width: "100%",
    height: 200,
    borderRadius: 16,
  },
  photoOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  retakeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  photoCheckmark: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  photoNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 10,
  },
  photoNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  footerNote: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 40,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  cameraTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  cameraBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  cameraFlipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraGuideContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  cameraGuide: {
    width: SCREEN_WIDTH - 80,
    height: SCREEN_WIDTH - 80,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#FFFFFF",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  cameraGuideText: {
    color: "#FFFFFF",
    fontSize: 15,
    marginTop: 20,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cameraBottomBar: {
    paddingBottom: 40,
    alignItems: "center",
  },
  captureButtonContainer: {
    alignItems: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  permissionIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
});

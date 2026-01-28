import { Card } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/lib/i18n/context";
import { useTheme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import {
  checkGeofence,
  formatDistance,
  type LocationWithAccuracy,
} from "@timezone/utils/geofence";
import { formatDurationFromMinutes } from "@timezone/utils/shifts";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { AnimatePresence, MotiView, ScrollView } from "moti";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const BUTTON_SIZE = Math.min(width * 0.42, 180);

type OrgLocation = {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isPrimary: boolean;
};

type ClockStatus = "clocked_out" | "clocked_in" | "pending_request";

type ScheduleSlot = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  breakMinutes: number;
};

type Schedule = {
  templateId: string;
  templateName: string;
  templateColor: string;
  slots: ScheduleSlot[];
  effectiveFrom: string | null;
  effectiveUntil: string | null;
};

export default function ClockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation("clock");
  const { t: tc } = useTranslation("common");
  const { t: tn } = useTranslation("navigation");
  const mapRef = useRef<MapView>(null);

  // Core state
  const [status, setStatus] = useState<ClockStatus>("clocked_out");
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);
  const [clockedInAt, setClockedInAt] = useState<Date | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Location state
  const [userLocation, setUserLocation] = useState<LocationWithAccuracy | null>(
    null
  );
  const [initialUserLocation, setInitialUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [orgLocations, setOrgLocations] = useState<OrgLocation[]>([]);
  const [orgName, setOrgName] = useState<string>("");
  const [isInRange, setIsInRange] = useState<boolean | null>(null);
  const [distanceFromWork, setDistanceFromWork] = useState<number>(0);
  const [nearestLocation, setNearestLocation] = useState<OrgLocation | null>(
    null
  );
  const [locationError, setLocationError] = useState<string | null>(null);

  // Pending request state
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  // Schedule state
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [hasSchedule, setHasSchedule] = useState(false);

  // Get last known location immediately on mount for faster map display
  useEffect(() => {
    const getQuickLocation = async () => {
      try {
        const { status: permStatus } =
          await Location.requestForegroundPermissionsAsync();
        if (permStatus !== "granted") return;

        // Try to get last known position first (very fast)
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          setInitialUserLocation({
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          });
        }
      } catch (error) {
        console.log("Could not get last known position:", error);
      }
    };

    getQuickLocation();
  }, []);

  // Fetch org locations on mount
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await api.getLocations();
        if (response.success && response.locations) {
          setOrgLocations(response.locations);
          setOrgName(response.organization?.name || "Work");
        }
      } catch (error) {
        console.error("Failed to fetch locations:", error);
      }
    };

    fetchLocations();
  }, []);

  // Fetch schedule on mount
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const response = await api.getMySchedule();
        if (response.hasSchedule && response.schedule) {
          setHasSchedule(true);
          setSchedule(response.schedule);
        } else {
          setHasSchedule(false);
          setSchedule(null);
        }
      } catch (error) {
        console.error("Failed to fetch schedule:", error);
      }
    };

    fetchSchedule();
  }, []);

  // Get today's day of week
  const getTodayDayOfWeek = (): string => {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    return days[new Date().getDay()];
  };

  // Get today's schedule slot
  const getTodaySlot = (): ScheduleSlot | null => {
    if (!schedule?.slots) return null;
    const today = getTodayDayOfWeek();
    return schedule.slots.find((slot) => slot.dayOfWeek === today) || null;
  };

  // Check if user is late based on schedule
  const getScheduleStatus = (): {
    isLate: boolean;
    lateMinutes: number;
  } | null => {
    const todaySlot = getTodaySlot();
    if (!todaySlot || status === "clocked_in") return null;

    const now = new Date();
    const [startHour, startMinute] = todaySlot.startTime.split(":").map(Number);

    const shiftStart = new Date();
    shiftStart.setHours(startHour, startMinute, 0, 0);

    // If current time is past shift start and not clocked in
    if (now > shiftStart) {
      const lateMinutes = Math.floor(
        (now.getTime() - shiftStart.getTime()) / 60000
      );
      return { isLate: true, lateMinutes };
    }

    return { isLate: false, lateMinutes: 0 };
  };

  const todaySlot = getTodaySlot();
  const scheduleStatus = getScheduleStatus();

  // Fetch current shift and pending requests on mount
  useEffect(() => {
    const fetchShiftStatus = async () => {
      try {
        const [shiftResponse, requestsResponse] = await Promise.all([
          api.getCurrentShift(),
          api.getMyRequests("pending"),
        ]);

        if (shiftResponse.success && shiftResponse.shift) {
          setStatus("clocked_in");
          setCurrentShiftId(shiftResponse.shift.id);
          setClockedInAt(new Date(shiftResponse.shift.clockInAt));
        }

        if (requestsResponse.success && requestsResponse.requests?.length > 0) {
          // Check if there's a pending clock-in request (user submitted request but not yet approved)
          const pendingClockIn = requestsResponse.requests.find(
            (r: { requestType: string }) => r.requestType === "clock_in"
          );
          if (pendingClockIn && status === "clocked_out") {
            setHasPendingRequest(true);
            // Show as "pending" - user already requested clock in
            setStatus("pending_request");
          }
        }
      } catch (error) {
        console.error("Failed to fetch shift status:", error);
      }
    };

    fetchShiftStatus();
  }, []);

  // Animate map when we get initial user location and org locations
  useEffect(() => {
    if (mapRef.current && initialUserLocation && orgLocations.length > 0) {
      const primaryLoc =
        orgLocations.find((l) => l.isPrimary) || orgLocations[0];
      mapRef.current.animateToRegion(
        {
          latitude: (initialUserLocation.latitude + primaryLoc.latitude) / 2,
          longitude: (initialUserLocation.longitude + primaryLoc.longitude) / 2,
          latitudeDelta:
            Math.abs(initialUserLocation.latitude - primaryLoc.latitude) * 2.5 +
            0.005,
          longitudeDelta:
            Math.abs(initialUserLocation.longitude - primaryLoc.longitude) *
              2.5 +
            0.005,
        },
        500
      );
    }
  }, [initialUserLocation, orgLocations]);

  // Location tracking
  useEffect(() => {
    let isMounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      try {
        const { status: permStatus } =
          await Location.requestForegroundPermissionsAsync();
        if (permStatus !== "granted") {
          setLocationError(t("location.permissionRequired"));
          return;
        }

        // Get initial location
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (!isMounted) return;

        const locationData: LocationWithAccuracy = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy || 50,
          timestamp: loc.timestamp,
        };

        setUserLocation(locationData);
        setLocationError(null);
        updateGeofenceStatus(locationData);

        // Center map on user location
        if (mapRef.current && orgLocations.length > 0) {
          const primaryLoc =
            orgLocations.find((l) => l.isPrimary) || orgLocations[0];
          mapRef.current.animateToRegion(
            {
              latitude: (locationData.latitude + primaryLoc.latitude) / 2,
              longitude: (locationData.longitude + primaryLoc.longitude) / 2,
              latitudeDelta:
                Math.abs(locationData.latitude - primaryLoc.latitude) * 2.5 +
                0.005,
              longitudeDelta:
                Math.abs(locationData.longitude - primaryLoc.longitude) * 2.5 +
                0.005,
            },
            1000
          );
        }

        // Subscribe to location updates
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000, // Update every 10 seconds
            distanceInterval: 10, // Or when moved 10 meters
          },
          (newLoc) => {
            if (!isMounted) return;

            const newLocationData: LocationWithAccuracy = {
              latitude: newLoc.coords.latitude,
              longitude: newLoc.coords.longitude,
              accuracy: newLoc.coords.accuracy || 50,
              timestamp: newLoc.timestamp,
            };

            setUserLocation(newLocationData);
            updateGeofenceStatus(newLocationData);
          }
        );
      } catch (error) {
        if (isMounted) {
          setLocationError(t("location.locationError"));
        }
      }
    };

    startLocationTracking();

    return () => {
      isMounted = false;
      locationSubscription?.remove();
    };
  }, [orgLocations]);

  // Update geofence status based on location
  const updateGeofenceStatus = useCallback(
    (location: LocationWithAccuracy) => {
      if (orgLocations.length === 0) return;

      let inRange = false;
      let minDistance = Infinity;
      let nearest: OrgLocation | null = null;

      for (const loc of orgLocations) {
        const result = checkGeofence(location, {
          center: { latitude: loc.latitude, longitude: loc.longitude },
          radiusMeters: loc.radiusMeters,
        });

        if (result.distanceMeters < minDistance) {
          minDistance = result.distanceMeters;
          nearest = loc;
        }

        if (result.isWithinRange) {
          inRange = true;
        }
      }

      setIsInRange(inRange);
      setDistanceFromWork(minDistance);
      setNearestLocation(nearest);
    },
    [orgLocations]
  );

  // Update elapsed time when clocked in
  useEffect(() => {
    if (status !== "clocked_in" || !clockedInAt) return;

    const updateElapsed = () => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - clockedInAt.getTime()) / 60000);
      setElapsedMinutes(diff);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [status, clockedInAt]);

  const performClockIn = useCallback(async () => {
    if (!userLocation) return;

    setIsProcessing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const response = await api.clockIn({
        location: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          accuracy: userLocation.accuracy,
        },
      });

      if (response.success) {
        setStatus("clocked_in");
        setCurrentShiftId(response.shift?.id || null);
        setClockedInAt(new Date());
        setElapsedMinutes(0);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } else {
        if (response.requiresRequest) {
          router.push("/request");
        } else {
          Alert.alert(
            tc("status.error"),
            response.error || tc("errors.generic")
          );
        }
      }
    } catch (error) {
      Alert.alert(tc("status.error"), tc("errors.network"));
    } finally {
      setIsProcessing(false);
    }
  }, [userLocation, router, t, tc]);

  const performClockOut = useCallback(async () => {
    if (!userLocation) return;

    setIsProcessing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const response = await api.clockOut({
        location: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          accuracy: userLocation.accuracy,
        },
      });

      if (response.success) {
        setStatus("clocked_out");
        setCurrentShiftId(null);
        setClockedInAt(null);
        setElapsedMinutes(0);
        setHasPendingRequest(false);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      } else {
        Alert.alert(tc("status.error"), response.error || tc("errors.generic"));
      }
    } catch (error) {
      Alert.alert(tc("status.error"), tc("errors.network"));
    } finally {
      setIsProcessing(false);
    }
  }, [userLocation, tc]);

  const handleClockAction = useCallback(async () => {
    if (isProcessing || !userLocation) return;

    // If out of range or has pending request, go to request screen
    if (
      (status === "clocked_out" && !isInRange) ||
      status === "pending_request"
    ) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push("/request");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (status === "clocked_out") {
      // Show confirmation for Clock In
      Alert.alert(t("dialogs.clockIn.title"), t("dialogs.clockIn.message"), [
        { text: tc("buttons.cancel"), style: "cancel" },
        {
          text: t("buttons.clockIn"),
          style: "default",
          onPress: performClockIn,
        },
      ]);
    } else if (status === "clocked_in") {
      // Show confirmation for Clock Out with duration
      const durationText = formatDurationFromMinutes(elapsedMinutes);
      Alert.alert(
        t("dialogs.clockOut.title"),
        t("dialogs.clockOut.message") +
          `\n\n${t("shift.duration")}: ${durationText}`,
        [
          { text: tc("buttons.cancel"), style: "cancel" },
          {
            text: t("buttons.clockOut"),
            style: "destructive",
            onPress: performClockOut,
          },
        ]
      );
    }
  }, [
    status,
    isInRange,
    isProcessing,
    userLocation,
    router,
    elapsedMinutes,
    performClockIn,
    performClockOut,
  ]);

  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const getStatusColor = () => {
    if (status === "clocked_in") return colors.success;
    if (status === "pending_request") return colors.warning;
    if (isInRange === false) return colors.warning;
    return colors.primary;
  };

  const getButtonGradient = (): [string, string] => {
    if (isProcessing) return [colors.textTertiary, colors.textTertiary];
    if (status === "clocked_in") return [colors.success, colors.successDark];
    if (status === "pending_request")
      return [colors.warning, colors.warningDark];
    if (isInRange === false) return [colors.warning, colors.warningDark];
    return [colors.primary, colors.primaryDark];
  };

  const getButtonText = () => {
    if (status === "clocked_in") return t("buttons.clockOut");
    if (status === "pending_request") return t("buttons.pending");
    if (isInRange === false) return t("buttons.request");
    return t("buttons.clockIn");
  };

  const getButtonIcon = () => {
    if (status === "clocked_in") return "exit-outline";
    if (status === "pending_request") return "hourglass-outline";
    if (isInRange === false) return "document-text-outline";
    return "enter-outline";
  };

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`
    : "Employee";

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("greeting.morning");
    if (hour < 17) return t("greeting.afternoon");
    return t("greeting.evening");
  };

  // Map initial region - try to show both user location and org location
  const getInitialRegion = () => {
    const userLoc = initialUserLocation || userLocation;

    if (orgLocations.length > 0) {
      const primary = orgLocations.find((l) => l.isPrimary) || orgLocations[0];

      // If we have user location, show both user and org location
      if (userLoc) {
        return {
          latitude: (userLoc.latitude + primary.latitude) / 2,
          longitude: (userLoc.longitude + primary.longitude) / 2,
          latitudeDelta:
            Math.abs(userLoc.latitude - primary.latitude) * 2.5 + 0.005,
          longitudeDelta:
            Math.abs(userLoc.longitude - primary.longitude) * 2.5 + 0.005,
        };
      }

      return {
        latitude: primary.latitude,
        longitude: primary.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    // If we have user location but no org locations yet
    if (userLoc) {
      return {
        latitude: userLoc.latitude,
        longitude: userLoc.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    // Default fallback (Ulaanbaatar)
    return {
      latitude: 47.9184,
      longitude: 106.9177,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            {greeting()}
          </Text>
          <Text style={[styles.userName, { color: colors.text }]}>
            {displayName}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.notificationBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => router.push("/notifications")}
        >
          <Ionicons
            name="notifications-outline"
            size={22}
            color={colors.text}
          />
          {hasPendingRequest && (
            <View
              style={[
                styles.notificationBadge,
                { backgroundColor: colors.warning },
              ]}
            >
              <Text style={styles.notificationBadgeText}>!</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Map Card */}
      <Card style={styles.mapCard} padding="none">
        <View
          style={[
            styles.mapContainer,
            { backgroundColor: colors.backgroundSecondary },
          ]}
        >
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={getInitialRegion()}
            showsUserLocation={true}
            showsMyLocationButton={false}
            showsCompass={false}
            mapType={isDark ? "mutedStandard" : "standard"}
          >
            {/* Geofence circles for each location */}
            {orgLocations.map((loc) => (
              <Circle
                key={loc.id}
                center={{ latitude: loc.latitude, longitude: loc.longitude }}
                radius={loc.radiusMeters}
                fillColor={
                  isInRange
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(251, 113, 133, 0.15)"
                }
                strokeColor={isInRange ? colors.success : colors.warning}
                strokeWidth={2}
              />
            ))}

            {/* Work location markers */}
            {orgLocations.map((loc) => (
              <Marker
                key={`marker-${loc.id}`}
                coordinate={{
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                }}
                title={loc.name}
                description={loc.address}
              >
                <View
                  style={[styles.workPin, { backgroundColor: colors.primary }]}
                >
                  <Ionicons name="business" size={16} color="#FFF" />
                </View>
              </Marker>
            ))}
          </MapView>

          {/* Re-center button */}
          <TouchableOpacity
            style={[
              styles.recenterBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => {
              if (mapRef.current && userLocation && orgLocations.length > 0) {
                const primaryLoc =
                  orgLocations.find((l) => l.isPrimary) || orgLocations[0];
                mapRef.current.animateToRegion(
                  {
                    latitude: (userLocation.latitude + primaryLoc.latitude) / 2,
                    longitude:
                      (userLocation.longitude + primaryLoc.longitude) / 2,
                    latitudeDelta:
                      Math.abs(userLocation.latitude - primaryLoc.latitude) *
                        2.5 +
                      0.005,
                    longitudeDelta:
                      Math.abs(userLocation.longitude - primaryLoc.longitude) *
                        2.5 +
                      0.005,
                  },
                  500
                );
              }
            }}
          >
            <Ionicons name="locate" size={20} color={colors.primary} />
          </TouchableOpacity>

          {/* Location Info Overlay */}
          <View
            style={[
              styles.locationOverlay,
              { backgroundColor: colors.surface + "F0" },
            ]}
          >
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={18} color={getStatusColor()} />
              <View style={styles.locationTextContainer}>
                <Text style={[styles.locationName, { color: colors.text }]}>
                  {nearestLocation?.name || orgName || tc("labels.location")}
                </Text>
                <Text
                  style={[
                    styles.locationDistance,
                    { color: colors.textSecondary },
                  ]}
                >
                  {locationError
                    ? locationError
                    : userLocation
                    ? isInRange
                      ? t("location.withinWorkZone")
                      : formatDistance(distanceFromWork) +
                        " " +
                        t("location.away")
                    : t("location.gettingLocation")}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.statusIndicator,
                {
                  backgroundColor:
                    status === "pending_request"
                      ? colors.warningBackground
                      : isInRange
                      ? colors.successBackground
                      : colors.warningBackground,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      status === "pending_request"
                        ? colors.warning
                        : isInRange
                        ? colors.success
                        : colors.warning,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      status === "pending_request"
                        ? colors.warningDark
                        : isInRange
                        ? colors.successDark
                        : colors.warningDark,
                  },
                ]}
              >
                {status === "pending_request"
                  ? t("status.pending")
                  : isInRange
                  ? t("status.inRange")
                  : t("status.outOfRange")}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Today's Schedule Card */}
      {hasSchedule && (
        <Card style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <View style={styles.scheduleHeaderLeft}>
              <Ionicons name="calendar" size={18} color={colors.primary} />
              <Text style={[styles.scheduleTitle, { color: colors.text }]}>
                {t("schedule.todayShift")}
              </Text>
            </View>
            {schedule && (
              <View
                style={[
                  styles.scheduleBadge,
                  { backgroundColor: schedule.templateColor + "20" },
                ]}
              >
                <View
                  style={[
                    styles.scheduleBadgeDot,
                    { backgroundColor: schedule.templateColor },
                  ]}
                />
                <Text
                  style={[
                    styles.scheduleBadgeText,
                    { color: schedule.templateColor },
                  ]}
                >
                  {schedule.templateName}
                </Text>
              </View>
            )}
          </View>

          {todaySlot ? (
            <View style={styles.scheduleContent}>
              <View style={styles.scheduleTimeRow}>
                <View style={styles.scheduleTimeItem}>
                  <Ionicons
                    name="enter-outline"
                    size={16}
                    color={colors.success}
                  />
                  <Text
                    style={[
                      styles.scheduleTimeLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t("schedule.start")}
                  </Text>
                  <Text
                    style={[styles.scheduleTimeValue, { color: colors.text }]}
                  >
                    {todaySlot.startTime}
                  </Text>
                </View>
                <View
                  style={[
                    styles.scheduleTimeDivider,
                    { backgroundColor: colors.border },
                  ]}
                />
                <View style={styles.scheduleTimeItem}>
                  <Ionicons
                    name="exit-outline"
                    size={16}
                    color={colors.error}
                  />
                  <Text
                    style={[
                      styles.scheduleTimeLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t("schedule.end")}
                  </Text>
                  <Text
                    style={[styles.scheduleTimeValue, { color: colors.text }]}
                  >
                    {todaySlot.endTime}
                  </Text>
                </View>
                {todaySlot.breakMinutes > 0 && (
                  <>
                    <View
                      style={[
                        styles.scheduleTimeDivider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                    <View style={styles.scheduleTimeItem}>
                      <Ionicons
                        name="cafe-outline"
                        size={16}
                        color={colors.warning}
                      />
                      <Text
                        style={[
                          styles.scheduleTimeLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {t("schedule.break")}
                      </Text>
                      <Text
                        style={[
                          styles.scheduleTimeValue,
                          { color: colors.text },
                        ]}
                      >
                        {todaySlot.breakMinutes}m
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* Late indicator */}
              {scheduleStatus?.isLate && status === "clocked_out" && (
                <View
                  style={[
                    styles.lateIndicator,
                    { backgroundColor: colors.errorBackground },
                  ]}
                >
                  <Ionicons name="warning" size={16} color={colors.error} />
                  <Text style={[styles.lateText, { color: colors.error }]}>
                    {t("schedule.late", {
                      minutes: scheduleStatus.lateMinutes,
                    })}
                  </Text>
                </View>
              )}

              {/* Night shift indicator */}
              {todaySlot.crossesMidnight && (
                <View
                  style={[
                    styles.nightShiftIndicator,
                    { backgroundColor: colors.primaryBackground },
                  ]}
                >
                  <Ionicons name="moon" size={14} color={colors.primary} />
                  <Text
                    style={[styles.nightShiftText, { color: colors.primary }]}
                  >
                    {t("schedule.nightShift")}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noShiftContainer}>
              <Ionicons
                name="sunny-outline"
                size={24}
                color={colors.textTertiary}
              />
              <Text
                style={[styles.noShiftText, { color: colors.textSecondary }]}
              >
                {t("schedule.dayOff")}
              </Text>
            </View>
          )}
        </Card>
      )}

      {/* Time Display */}
      <View style={styles.timeContainer}>
        <Text style={[styles.currentTime, { color: colors.text }]}>
          {currentTime}
        </Text>
        <Text style={[styles.currentDate, { color: colors.textSecondary }]}>
          {currentDate}
        </Text>
      </View>

      {/* Clock Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={handleClockAction}
          activeOpacity={0.9}
          disabled={isProcessing}
          style={styles.clockButtonWrapper}
        >
          {/* Outer glow ring */}
          {status === "clocked_in" && (
            <MotiView
              from={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.2, opacity: 0 }}
              transition={{ loop: true, type: "timing", duration: 2000 }}
              style={[
                styles.glowRing,
                {
                  backgroundColor: colors.success,
                  width: BUTTON_SIZE + 40,
                  height: BUTTON_SIZE + 40,
                },
              ]}
            />
          )}

          {/* Main Button */}
          <MotiView
            animate={{ scale: isProcessing ? 0.95 : 1 }}
            transition={{ type: "spring", damping: 15 }}
          >
            <LinearGradient
              colors={getButtonGradient()}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.clockButton,
                { width: BUTTON_SIZE, height: BUTTON_SIZE },
              ]}
            >
              <AnimatePresence exitBeforeEnter>
                {isProcessing ? (
                  <MotiView
                    key="loading"
                    from={{ rotate: "0deg" }}
                    animate={{ rotate: "360deg" }}
                    transition={{ loop: true, type: "timing", duration: 1000 }}
                  >
                    <Ionicons name="sync" size={42} color="#FFF" />
                  </MotiView>
                ) : (
                  <MotiView
                    key="content"
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={styles.buttonContent}
                  >
                    <Ionicons name={getButtonIcon()} size={42} color="#FFF" />
                    <Text style={styles.buttonText}>{getButtonText()}</Text>
                  </MotiView>
                )}
              </AnimatePresence>
            </LinearGradient>
          </MotiView>
        </TouchableOpacity>

        {/* Status text below button */}
        <Text style={[styles.statusHint, { color: colors.textTertiary }]}>
          {status === "clocked_in"
            ? t("shift.tapToEnd")
            : status === "pending_request"
            ? t("shift.requestPending")
            : isInRange === false
            ? t("request.subtitle")
            : t("shift.tapToStart")}
        </Text>
      </View>

      {/* Shift Info Card (when clocked in) */}
      {status === "clocked_in" && clockedInAt && (
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: 20 }}
          style={styles.shiftInfoContainer}
        >
          <Card style={styles.shiftCard}>
            <View style={styles.shiftInfo}>
              <View style={styles.shiftInfoItem}>
                <Text
                  style={[
                    styles.shiftInfoLabel,
                    { color: colors.textTertiary },
                  ]}
                >
                  {t("shift.startedAt")}
                </Text>
                <Text style={[styles.shiftInfoValue, { color: colors.text }]}>
                  {clockedInAt.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </Text>
              </View>
              <View
                style={[
                  styles.shiftInfoDivider,
                  { backgroundColor: colors.border },
                ]}
              />
              <View style={styles.shiftInfoItem}>
                <Text
                  style={[
                    styles.shiftInfoLabel,
                    { color: colors.textTertiary },
                  ]}
                >
                  {t("shift.duration")}
                </Text>
                <Text
                  style={[styles.shiftInfoValue, { color: colors.success }]}
                >
                  {formatDurationFromMinutes(elapsedMinutes)}
                </Text>
              </View>
            </View>
          </Card>
        </MotiView>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[
            styles.quickAction,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => router.push("/calendar")}
        >
          <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          <Text style={[styles.quickActionText, { color: colors.text }]}>
            {t("calendar.title")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.quickAction,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => router.push("/request")}
        >
          <Ionicons
            name="document-text-outline"
            size={22}
            color={colors.primary}
          />
          <Text style={[styles.quickActionText, { color: colors.text }]}>
            {t("request.title")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.quickAction,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => router.push("/profile")}
        >
          <Ionicons name="person-outline" size={22} color={colors.primary} />
          <Text style={[styles.quickActionText, { color: colors.text }]}>
            {tn("main.profile")}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  },
  greeting: {
    fontSize: 14,
    fontWeight: "500",
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  notificationBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  mapCard: {
    marginHorizontal: 20,
    overflow: "hidden",
  },
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  workPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  recenterBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  locationOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  locationTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  locationName: {
    fontSize: 14,
    fontWeight: "600",
  },
  locationDistance: {
    fontSize: 12,
    marginTop: 1,
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  timeContainer: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 8,
  },
  currentTime: {
    fontSize: 44,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  currentDate: {
    fontSize: 15,
    marginTop: 4,
  },
  buttonContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  clockButtonWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  glowRing: {
    position: "absolute",
    borderRadius: 999,
  },
  clockButton: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  buttonContent: {
    alignItems: "center",
  },
  buttonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  statusHint: {
    marginVertical: 12,
    fontSize: 13,
  },
  shiftInfoContainer: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  shiftCard: {},
  shiftInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  shiftInfoItem: {
    flex: 1,
    alignItems: "center",
  },
  shiftInfoLabel: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  shiftInfoValue: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
  },
  shiftInfoDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 100 : 80,
  },
  quickAction: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 90,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },
  // Schedule card styles
  scheduleCard: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  scheduleHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scheduleTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  scheduleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  scheduleBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scheduleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  scheduleContent: {
    gap: 12,
  },
  scheduleTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleTimeItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  scheduleTimeLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scheduleTimeValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  scheduleTimeDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 8,
  },
  lateIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  lateText: {
    fontSize: 13,
    fontWeight: "600",
  },
  nightShiftIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  nightShiftText: {
    fontSize: 12,
    fontWeight: "500",
  },
  noShiftContainer: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  noShiftText: {
    fontSize: 14,
    fontWeight: "500",
  },
});

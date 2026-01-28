import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";

/**
 * STALE SHIFT RESOLUTION SCREEN
 *
 * Shown when a user opens the app and has a shift that's been
 * open for more than 16 hours (likely forgot to clock out).
 *
 * The user must resolve this before they can use the app normally.
 */

export default function StaleResolutionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    shiftId: string;
    clockInAt: string;
    hoursOpen: string;
    location: string;
  }>();

  const [estimatedClockOut, setEstimatedClockOut] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clockInDate = new Date(params.clockInAt || new Date());

  const handleSubmit = async () => {
    if (reason.length < 10) {
      Alert.alert("Error", "Please provide a more detailed explanation (at least 10 characters).");
      return;
    }

    if (estimatedClockOut <= clockInDate) {
      Alert.alert("Error", "Clock out time must be after your clock in time.");
      return;
    }

    setIsSubmitting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // TODO: Submit to API
    await new Promise((resolve) => setTimeout(resolve, 1500));

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Alert.alert(
      "Submitted",
      "Your shift resolution has been submitted for manager review. You can continue using the app.",
      [{ text: "OK", onPress: () => router.replace("/(tabs)") }]
    );
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDuration = () => {
    const diffMs = estimatedClockOut.getTime() - clockInDate.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <View className="flex-1 bg-neutral-50" style={{ paddingTop: insets.top }}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Warning Header */}
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="mx-6 mt-6"
        >
          <View className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <View className="flex-row items-center mb-4">
              <View className="w-12 h-12 bg-amber-100 rounded-full items-center justify-center mr-4">
                <Ionicons name="warning" size={24} color="#F59E0B" />
              </View>
              <View className="flex-1">
                <Text className="text-amber-900 text-lg font-bold">
                  Unresolved Shift
                </Text>
                <Text className="text-amber-700 text-sm">
                  Open for {params.hoursOpen || "18+"} hours
                </Text>
              </View>
            </View>

            <Text className="text-amber-800 text-base leading-relaxed">
              It looks like you forgot to clock out. Please provide your estimated
              clock out time so we can close this shift.
            </Text>
          </View>
        </MotiView>

        {/* Shift Details Card */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 200 }}
          className="mx-6 mt-6 bg-white rounded-2xl p-6 shadow-sm border border-neutral-100"
        >
          <Text className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-4">
            Original Clock In
          </Text>

          <View className="flex-row items-center mb-4">
            <View className="w-10 h-10 bg-primary-50 rounded-full items-center justify-center mr-3">
              <Ionicons name="enter-outline" size={20} color="#6366F1" />
            </View>
            <View>
              <Text className="text-neutral-900 font-semibold">
                {formatDateTime(clockInDate)}
              </Text>
              <Text className="text-neutral-500 text-sm">
                {params.location || "Main Hospital"}
              </Text>
            </View>
          </View>
        </MotiView>

        {/* Resolution Form */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 400 }}
          className="mx-6 mt-6 bg-white rounded-2xl p-6 shadow-sm border border-neutral-100"
        >
          <Text className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-4">
            Estimated Clock Out
          </Text>

          {/* Date Picker */}
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="flex-row items-center border border-neutral-200 rounded-xl p-4 mb-4"
          >
            <Ionicons name="calendar-outline" size={20} color="#6B7280" />
            <Text className="text-neutral-900 ml-3 flex-1">
              {estimatedClockOut.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Time Picker */}
          <TouchableOpacity
            onPress={() => setShowTimePicker(true)}
            className="flex-row items-center border border-neutral-200 rounded-xl p-4 mb-4"
          >
            <Ionicons name="time-outline" size={20} color="#6B7280" />
            <Text className="text-neutral-900 ml-3 flex-1">
              {estimatedClockOut.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Duration Preview */}
          <View className="bg-neutral-50 rounded-xl p-4 mb-6">
            <Text className="text-neutral-500 text-sm">Estimated Duration</Text>
            <Text className="text-neutral-900 text-2xl font-bold">
              {formatDuration()}
            </Text>
          </View>

          {/* Reason Input */}
          <Text className="text-neutral-700 font-medium mb-2">
            Reason for missing clock out
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="e.g., Was busy with patient emergency and forgot..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="border border-neutral-200 rounded-xl p-4 text-neutral-900 min-h-[100px]"
          />
          <Text className="text-neutral-400 text-xs mt-2">
            {reason.length}/10 characters minimum
          </Text>
        </MotiView>

        {/* Submit Button */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 600 }}
          className="mx-6 mt-6 mb-8"
        >
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting || reason.length < 10}
            className={`py-4 rounded-xl items-center ${
              isSubmitting || reason.length < 10
                ? "bg-neutral-300"
                : "bg-primary-500"
            }`}
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold text-lg">
              {isSubmitting ? "Submitting..." : "Submit for Review"}
            </Text>
          </TouchableOpacity>

          <Text className="text-neutral-400 text-xs text-center mt-4">
            Your manager will review this resolution request.
          </Text>
        </MotiView>
      </ScrollView>

      {/* Date/Time Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={estimatedClockOut}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={clockInDate}
          maximumDate={new Date()}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              const newDate = new Date(estimatedClockOut);
              newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
              setEstimatedClockOut(newDate);
            }
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={estimatedClockOut}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, date) => {
            setShowTimePicker(false);
            if (date) {
              const newDate = new Date(estimatedClockOut);
              newDate.setHours(date.getHours(), date.getMinutes());
              setEstimatedClockOut(newDate);
            }
          }}
        />
      )}
    </View>
  );
}

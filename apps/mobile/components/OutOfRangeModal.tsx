import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatDistance } from "@timezone/utils/geofence";

interface OutOfRangeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  distance: number;
  locationName: string;
  requestType: "clock_in" | "clock_out";
}

/**
 * OUT OF RANGE REQUEST MODAL
 *
 * Shown when a user tries to clock in/out while outside the geofence.
 * They can submit a request with a reason for manager approval.
 */
export function OutOfRangeModal({
  visible,
  onClose,
  onSubmit,
  distance,
  locationName,
  requestType,
}: OutOfRangeModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (reason.length < 10) return;

    setIsSubmitting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await onSubmit(reason);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReason("");
      onClose();
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason("");
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-black/50 justify-end"
      >
        <TouchableOpacity
          className="flex-1"
          activeOpacity={1}
          onPress={handleClose}
        />

        <MotiView
          from={{ translateY: 300, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          exit={{ translateY: 300, opacity: 0 }}
          transition={{ type: "timing", duration: 300 }}
          className="bg-white rounded-t-3xl"
        >
          {/* Handle */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 bg-neutral-200 rounded-full" />
          </View>

          {/* Content */}
          <View className="px-6 pb-8">
            {/* Warning Icon */}
            <View className="items-center mb-6">
              <View className="w-16 h-16 bg-rose-100 rounded-full items-center justify-center mb-3">
                <Ionicons name="location-outline" size={32} color="#F43F5E" />
              </View>
              <Text className="text-neutral-900 text-xl font-bold text-center">
                Outside Work Location
              </Text>
              <Text className="text-neutral-500 text-center mt-1">
                You are{" "}
                <Text className="text-rose-600 font-semibold">
                  {formatDistance(distance)}
                </Text>{" "}
                from {locationName}
              </Text>
            </View>

            {/* Info Box */}
            <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <View className="flex-row items-start">
                <Ionicons name="information-circle" size={20} color="#F59E0B" />
                <Text className="text-amber-800 text-sm ml-2 flex-1">
                  Your {requestType === "clock_in" ? "clock in" : "clock out"}{" "}
                  request will be sent to your manager for approval.
                </Text>
              </View>
            </View>

            {/* Reason Input */}
            <Text className="text-neutral-700 font-medium mb-2">
              Why are you{" "}
              {requestType === "clock_in" ? "clocking in" : "clocking out"} from
              here?
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="e.g., Working from client site today..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="border border-neutral-200 rounded-xl p-4 text-neutral-900 min-h-[80px] mb-2"
              editable={!isSubmitting}
            />
            <Text
              className={`text-xs ${
                reason.length >= 10 ? "text-green-600" : "text-neutral-400"
              }`}
            >
              {reason.length}/10 characters minimum
            </Text>

            {/* Buttons */}
            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={handleClose}
                disabled={isSubmitting}
                className="flex-1 py-4 rounded-xl bg-neutral-100 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-neutral-700 font-semibold">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting || reason.length < 10}
                className={`flex-1 py-4 rounded-xl items-center ${
                  isSubmitting || reason.length < 10
                    ? "bg-neutral-300"
                    : "bg-primary-500"
                }`}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold">Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </MotiView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

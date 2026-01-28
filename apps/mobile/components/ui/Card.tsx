import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "@/lib/theme";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({
  children,
  style,
  elevated = false,
  padding = "md",
}: CardProps) {
  const { colors, isDark } = useTheme();

  const paddingValues = {
    none: 0,
    sm: 12,
    md: 16,
    lg: 24,
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
          padding: paddingValues[padding],
          shadowColor: colors.shadow,
        },
        elevated && styles.elevated,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
  elevated: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
});

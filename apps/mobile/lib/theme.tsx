import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  colors: typeof lightColors;
}

const lightColors = {
  // Backgrounds
  background: "#FFFFFF",
  backgroundSecondary: "#F8FAFC",
  backgroundTertiary: "#F1F5F9",

  // Surfaces
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",

  // Text
  text: "#0F172A",
  textSecondary: "#475569",
  textTertiary: "#94A3B8",
  textInverse: "#FFFFFF",

  // Primary brand
  primary: "#6366F1",
  primaryLight: "#818CF8",
  primaryDark: "#4F46E5",
  primaryBackground: "#EEF2FF",

  // Success (Clocked in, approved)
  success: "#10B981",
  successLight: "#34D399",
  successDark: "#059669",
  successBackground: "#D1FAE5",

  // Warning (Out of range, pending)
  warning: "#F59E0B",
  warningLight: "#FBBF24",
  warningDark: "#D97706",
  warningBackground: "#FEF3C7",

  // Error/Danger
  error: "#EF4444",
  errorLight: "#F87171",
  errorDark: "#DC2626",
  errorBackground: "#FEE2E2",

  // Info
  info: "#3B82F6",
  infoLight: "#60A5FA",
  infoDark: "#2563EB",
  infoBackground: "#DBEAFE",

  // Borders
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  borderDark: "#CBD5E1",

  // Misc
  overlay: "rgba(15, 23, 42, 0.5)",
  shadow: "rgba(15, 23, 42, 0.08)",

  // Map specific
  geofenceIn: "rgba(16, 185, 129, 0.2)",
  geofenceOut: "rgba(239, 68, 68, 0.2)",
  geofenceStroke: "#10B981",
  geofenceStrokeOut: "#EF4444",
};

const darkColors: typeof lightColors = {
  // Backgrounds
  background: "#0F172A",
  backgroundSecondary: "#1E293B",
  backgroundTertiary: "#334155",

  // Surfaces
  surface: "#1E293B",
  surfaceElevated: "#334155",

  // Text
  text: "#F8FAFC",
  textSecondary: "#CBD5E1",
  textTertiary: "#64748B",
  textInverse: "#0F172A",

  // Primary brand
  primary: "#818CF8",
  primaryLight: "#A5B4FC",
  primaryDark: "#6366F1",
  primaryBackground: "#312E81",

  // Success
  success: "#34D399",
  successLight: "#6EE7B7",
  successDark: "#10B981",
  successBackground: "#064E3B",

  // Warning
  warning: "#FBBF24",
  warningLight: "#FCD34D",
  warningDark: "#F59E0B",
  warningBackground: "#78350F",

  // Error
  error: "#F87171",
  errorLight: "#FCA5A5",
  errorDark: "#EF4444",
  errorBackground: "#7F1D1D",

  // Info
  info: "#60A5FA",
  infoLight: "#93C5FD",
  infoDark: "#3B82F6",
  infoBackground: "#1E3A8A",

  // Borders
  border: "#334155",
  borderLight: "#475569",
  borderDark: "#1E293B",

  // Misc
  overlay: "rgba(0, 0, 0, 0.7)",
  shadow: "rgba(0, 0, 0, 0.3)",

  // Map specific
  geofenceIn: "rgba(52, 211, 153, 0.25)",
  geofenceOut: "rgba(248, 113, 113, 0.25)",
  geofenceStroke: "#34D399",
  geofenceStrokeOut: "#F87171",
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "@timezone/theme_mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored && ["light", "dark", "system"].includes(stored)) {
        setModeState(stored as ThemeMode);
      }
      setIsLoaded(true);
    });
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
  };

  const isDark =
    mode === "dark" || (mode === "system" && systemColorScheme === "dark");

  const colors = isDark ? darkColors : lightColors;

  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export { lightColors, darkColors };

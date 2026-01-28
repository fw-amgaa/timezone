import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

// Import translations from shared package
import mnCommon from "@timezone/i18n/locales/mn/common.json";
import mnAuth from "@timezone/i18n/locales/mn/auth.json";
import mnClock from "@timezone/i18n/locales/mn/clock.json";
import mnDashboard from "@timezone/i18n/locales/mn/dashboard.json";
import mnSettings from "@timezone/i18n/locales/mn/settings.json";
import mnNavigation from "@timezone/i18n/locales/mn/navigation.json";
import mnTime from "@timezone/i18n/locales/mn/time.json";

import enCommon from "@timezone/i18n/locales/en/common.json";
import enAuth from "@timezone/i18n/locales/en/auth.json";
import enClock from "@timezone/i18n/locales/en/clock.json";
import enDashboard from "@timezone/i18n/locales/en/dashboard.json";
import enSettings from "@timezone/i18n/locales/en/settings.json";
import enNavigation from "@timezone/i18n/locales/en/navigation.json";
import enTime from "@timezone/i18n/locales/en/time.json";

export const resources = {
  mn: {
    common: mnCommon,
    auth: mnAuth,
    clock: mnClock,
    dashboard: mnDashboard,
    settings: mnSettings,
    navigation: mnNavigation,
    time: mnTime,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    clock: enClock,
    dashboard: enDashboard,
    settings: enSettings,
    navigation: enNavigation,
    time: enTime,
  },
} as const;

export const supportedLocales = ["mn", "en"] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = "mn";

export const localeNames: Record<Locale, string> = {
  mn: "Монгол",
  en: "English",
};

export const localeFlags: Record<Locale, string> = {
  mn: "\u{1F1F2}\u{1F1F3}",
  en: "\u{1F1FA}\u{1F1F8}",
};

// Get device locale, defaulting to Mongolian
const getDeviceLocale = (): Locale => {
  const deviceLocale = Localization.getLocales()[0]?.languageCode;
  if (deviceLocale && supportedLocales.includes(deviceLocale as Locale)) {
    return deviceLocale as Locale;
  }
  return defaultLocale;
};

// Initialize i18next
i18n.use(initReactI18next).init({
  resources,
  lng: defaultLocale, // Default to Mongolian
  fallbackLng: defaultLocale,
  defaultNS: "common",
  ns: ["common", "auth", "clock", "dashboard", "settings", "navigation", "time"],
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
export { i18n };

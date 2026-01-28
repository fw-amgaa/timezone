import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// Static imports for EN locale
import enCommon from "@timezone/i18n/locales/en/common.json";
import enAuth from "@timezone/i18n/locales/en/auth.json";
import enClock from "@timezone/i18n/locales/en/clock.json";
import enDashboard from "@timezone/i18n/locales/en/dashboard.json";
import enSettings from "@timezone/i18n/locales/en/settings.json";
import enNavigation from "@timezone/i18n/locales/en/navigation.json";
import enTime from "@timezone/i18n/locales/en/time.json";

// Static imports for MN locale
import mnCommon from "@timezone/i18n/locales/mn/common.json";
import mnAuth from "@timezone/i18n/locales/mn/auth.json";
import mnClock from "@timezone/i18n/locales/mn/clock.json";
import mnDashboard from "@timezone/i18n/locales/mn/dashboard.json";
import mnSettings from "@timezone/i18n/locales/mn/settings.json";
import mnNavigation from "@timezone/i18n/locales/mn/navigation.json";
import mnTime from "@timezone/i18n/locales/mn/time.json";

export const supportedLocales = ["mn", "en"] as const;
export const defaultLocale = "mn" as const;
export type Locale = (typeof supportedLocales)[number];

export const localeNames: Record<Locale, string> = {
  mn: "Монгол",
  en: "English",
};

export const localeFlags: Record<Locale, string> = {
  mn: "\u{1F1F2}\u{1F1F3}",
  en: "\u{1F1FA}\u{1F1F8}",
};

const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

const messages = {
  en: {
    common: enCommon,
    auth: enAuth,
    clock: enClock,
    dashboard: enDashboard,
    settings: enSettings,
    navigation: enNavigation,
    time: enTime,
  },
  mn: {
    common: mnCommon,
    auth: mnAuth,
    clock: mnClock,
    dashboard: mnDashboard,
    settings: mnSettings,
    navigation: mnNavigation,
    time: mnTime,
  },
} as const;

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const locale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (locale && supportedLocales.includes(locale as Locale)) {
    return locale as Locale;
  }
  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await getLocale();

  return {
    locale,
    messages: messages[locale],
  };
});

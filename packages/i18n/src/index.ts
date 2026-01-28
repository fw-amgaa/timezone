/**
 * @timezone/i18n - Internationalization package
 *
 * Provides translations for Mongolian (default) and English
 */

export const supportedLocales = ["mn", "en"] as const;
export const defaultLocale = "mn" as const;
export type Locale = (typeof supportedLocales)[number];

export const localeNames: Record<Locale, string> = {
  mn: "Монгол",
  en: "English",
};

export const localeFlags: Record<Locale, string> = {
  mn: "🇲🇳",
  en: "🇺🇸",
};

/**
 * Check if a locale is supported
 */
export function isValidLocale(locale: string): locale is Locale {
  return supportedLocales.includes(locale as Locale);
}

/**
 * Get the best matching locale from a list of preferred locales
 */
export function getBestLocale(preferredLocales: string[]): Locale {
  for (const locale of preferredLocales) {
    const lang = locale.split("-")[0].toLowerCase();
    if (isValidLocale(lang)) {
      return lang;
    }
  }
  return defaultLocale;
}

// Re-export translation types
export type TranslationNamespace =
  | "common"
  | "auth"
  | "clock"
  | "dashboard"
  | "settings"
  | "navigation"
  | "time";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n, {
  Locale,
  defaultLocale,
  supportedLocales,
  localeNames,
  localeFlags,
} from "./index";

const LANGUAGE_STORAGE_KEY = "@timezone/language";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  isLoading: boolean;
  localeNames: Record<Locale, string>;
  localeFlags: Record<Locale, string>;
  supportedLocales: readonly Locale[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved language preference on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLocale = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (
          savedLocale &&
          supportedLocales.includes(savedLocale as Locale)
        ) {
          const validLocale = savedLocale as Locale;
          setLocaleState(validLocale);
          await i18n.changeLanguage(validLocale);
        }
      } catch (error) {
        console.error("Failed to load language preference:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, []);

  const setLocale = useCallback(async (newLocale: Locale) => {
    try {
      setLocaleState(newLocale);
      await i18n.changeLanguage(newLocale);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLocale);
    } catch (error) {
      console.error("Failed to save language preference:", error);
    }
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider
        value={{
          locale,
          setLocale,
          isLoading,
          localeNames,
          localeFlags,
          supportedLocales,
        }}
      >
        {children}
      </LanguageContext.Provider>
    </I18nextProvider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

// Re-export useTranslation for convenience
export { useTranslation };

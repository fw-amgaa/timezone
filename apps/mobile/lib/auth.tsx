/**
 * Auth Store & Context
 * Manages authentication state, biometrics, and session persistence
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";
import { api } from "./api";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  role: string;
  organizationId: string;
  position?: string;
  registrationNumber?: string;
  preferences?: {
    notifications?: boolean;
    display?: any;
    biometricEnabled?: boolean;
  };
  createdAt: string;
}

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  biometricsAvailable: boolean;
  biometricsEnabled: boolean;
  keepLoggedIn: boolean;
}

interface AuthContextType extends AuthState {
  // Auth actions
  login: (
    phone: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginWithBiometrics: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;

  // Settings
  enableBiometrics: (password: string) => Promise<boolean>;
  disableBiometrics: () => Promise<void>;
  setKeepLoggedIn: (value: boolean) => Promise<void>;

  // Session check
  checkSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SECURE_KEYS = {
  BIOMETRIC_PHONE: "biometric_phone",
  BIOMETRIC_PASSWORD: "biometric_password",
  KEEP_LOGGED_IN: "keep_logged_in",
  USER_DATA: "user_data",
} as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    biometricsAvailable: false,
    biometricsEnabled: false,
    keepLoggedIn: false,
  });

  // Check biometrics availability on mount
  useEffect(() => {
    checkBiometricsAvailability();
    initializeAuth();
  }, []);

  const checkBiometricsAvailability = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const biometricPhone = await SecureStore.getItemAsync(
      SECURE_KEYS.BIOMETRIC_PHONE
    );

    setState((prev) => ({
      ...prev,
      biometricsAvailable: hasHardware && isEnrolled,
      biometricsEnabled: !!biometricPhone,
    }));
  };

  const initializeAuth = async () => {
    try {
      await api.init();

      const keepLoggedIn = await SecureStore.getItemAsync(
        SECURE_KEYS.KEEP_LOGGED_IN
      );
      const userData = await SecureStore.getItemAsync(SECURE_KEYS.USER_DATA);

      // If user has tokens and keep logged in is enabled, restore session
      if (api.hasTokens() && keepLoggedIn === "true" && userData) {
        const user = JSON.parse(userData);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: true,
          user,
          keepLoggedIn: true,
        }));
        return;
      }

      // If tokens exist but keep logged in is false, we still validate them
      if (api.hasTokens()) {
        // Tokens exist but keepLoggedIn is false - clear them
        if (keepLoggedIn !== "true") {
          await api.clearTokens();
        }
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        keepLoggedIn: keepLoggedIn === "true",
      }));
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const login = useCallback(async (phone: string, password: string) => {
    const deviceInfo = {
      platform: Platform.OS,
      appVersion: "1.0.0",
    };

    const response = await api.login(phone, password, deviceInfo);

    if (response.success && response.user) {
      await SecureStore.setItemAsync(
        SECURE_KEYS.USER_DATA,
        JSON.stringify(response.user)
      );

      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        user: response.user,
      }));

      return { success: true };
    }

    return { success: false, error: response.error };
  }, []);

  const loginWithBiometrics = useCallback(async () => {
    if (!state.biometricsEnabled || !state.biometricsAvailable) {
      return { success: false, error: "Biometrics not available" };
    }

    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: "Login with biometrics",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });

    if (!authResult.success) {
      return { success: false, error: "Biometric authentication failed" };
    }

    const phone = await SecureStore.getItemAsync(SECURE_KEYS.BIOMETRIC_PHONE);
    const password = await SecureStore.getItemAsync(
      SECURE_KEYS.BIOMETRIC_PASSWORD
    );

    if (!phone || !password) {
      return { success: false, error: "Biometric credentials not found" };
    }

    return login(phone, password);
  }, [state.biometricsEnabled, state.biometricsAvailable, login]);

  const logout = useCallback(async () => {
    await api.logout();
    await SecureStore.deleteItemAsync(SECURE_KEYS.USER_DATA);

    // Keep biometric credentials and keepLoggedIn setting
    setState((prev) => ({
      ...prev,
      isAuthenticated: false,
      user: null,
    }));
  }, []);

  const setUser = useCallback((user: User) => {
    setState((prev) => ({
      ...prev,
      isAuthenticated: true,
      user,
    }));
    SecureStore.setItemAsync(SECURE_KEYS.USER_DATA, JSON.stringify(user));
  }, []);

  const enableBiometrics = useCallback(
    async (password: string) => {
      if (!state.user?.phone) return false;

      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: "Enable biometric login",
        cancelLabel: "Cancel",
      });

      if (!authResult.success) return false;

      await SecureStore.setItemAsync(
        SECURE_KEYS.BIOMETRIC_PHONE,
        state.user.phone
      );
      await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_PASSWORD, password);

      setState((prev) => ({ ...prev, biometricsEnabled: true }));
      return true;
    },
    [state.user?.phone]
  );

  const disableBiometrics = useCallback(async () => {
    await SecureStore.deleteItemAsync(SECURE_KEYS.BIOMETRIC_PHONE);
    await SecureStore.deleteItemAsync(SECURE_KEYS.BIOMETRIC_PASSWORD);
    setState((prev) => ({ ...prev, biometricsEnabled: false }));
  }, []);

  const setKeepLoggedIn = useCallback(async (value: boolean) => {
    await SecureStore.setItemAsync(
      SECURE_KEYS.KEEP_LOGGED_IN,
      value ? "true" : "false"
    );
    setState((prev) => ({ ...prev, keepLoggedIn: value }));
  }, []);

  const checkSession = useCallback(async () => {
    if (!api.hasTokens()) return false;

    // Try to make an authenticated request to verify session
    const response = await api.request("/api/mobile/auth/me");
    if (response.success && response.user) {
      setUser(response.user);
      return true;
    }

    return false;
  }, [setUser]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        loginWithBiometrics,
        logout,
        setUser,
        enableBiometrics,
        disableBiometrics,
        setKeepLoggedIn,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Default auth state for when context isn't available yet
const defaultAuthState: AuthContextType = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
  biometricsAvailable: false,
  biometricsEnabled: false,
  keepLoggedIn: false,
  login: async () => ({ success: false, error: "Auth not initialized" }),
  loginWithBiometrics: async () => ({
    success: false,
    error: "Auth not initialized",
  }),
  logout: async () => {},
  setUser: () => {},
  enableBiometrics: async () => false,
  disableBiometrics: async () => {},
  setKeepLoggedIn: async () => {},
  checkSession: async () => false,
};

export function useAuth() {
  const context = useContext(AuthContext);
  // Return default state if context isn't available yet (during initial mount)
  return context ?? defaultAuthState;
}

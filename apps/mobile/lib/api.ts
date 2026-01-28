/**
 * Mobile API Client
 * Handles all API calls to the backend with automatic token refresh
 */

import * as SecureStore from "expo-secure-store";

// API URL - change this for production
const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://6746c5269ff5.ngrok-free.app";

interface ApiResponse<T> {
  success: boolean;
  error?: string;
  [key: string]: any;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  async init() {
    this.accessToken = await SecureStore.getItemAsync("accessToken");
    this.refreshToken = await SecureStore.getItemAsync("refreshToken");
  }

  async setTokens(tokens: TokenResponse) {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    await SecureStore.setItemAsync("accessToken", tokens.accessToken);
    await SecureStore.setItemAsync("refreshToken", tokens.refreshToken);
  }

  async clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
  }

  hasTokens(): boolean {
    return !!this.accessToken && !!this.refreshToken;
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    // If already refreshing, wait for the existing promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.doRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/mobile/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      const data = await response.json();

      if (data.success && data.accessToken && data.refreshToken) {
        await this.setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresIn: data.expiresIn,
        });
        return true;
      }

      // Refresh failed, clear tokens
      await this.clearTokens();
      return false;
    } catch {
      await this.clearTokens();
      return false;
    }
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_URL}${endpoint}`;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)[
        "Authorization"
      ] = `Bearer ${this.accessToken}`;
    }

    try {
      let response = await fetch(url, { ...options, headers });

      // If unauthorized, try to refresh token
      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry the request with new token
          (headers as Record<string, string>)[
            "Authorization"
          ] = `Bearer ${this.accessToken}`;
          response = await fetch(url, { ...options, headers });
        }
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.log("error", error);
      return {
        success: false,
        error: "Network error. Please check your connection.",
      };
    }
  }

  // Auth endpoints
  async checkPhone(phone: string) {
    return this.request<{
      exists: boolean;
      hasPassword: boolean;
      user?: { firstName: string; lastName: string };
    }>("/api/mobile/auth/check-phone", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  }

  async sendOtp(phone: string) {
    return this.request<{ expiresIn: number }>("/api/mobile/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  }

  async verifyOtp(phone: string, code: string) {
    return this.request<{ verificationToken: string }>(
      "/api/mobile/auth/verify-otp",
      {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      }
    );
  }

  async setPassword(
    verificationToken: string,
    password: string,
    deviceInfo?: { platform?: string; deviceId?: string; appVersion?: string }
  ) {
    const response = await this.request<TokenResponse & { user: any }>(
      "/api/mobile/auth/set-password",
      {
        method: "POST",
        body: JSON.stringify({ verificationToken, password, deviceInfo }),
      }
    );

    if (response.success && response.accessToken) {
      await this.setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresIn: response.expiresIn,
      });
    }

    return response;
  }

  async login(
    phone: string,
    password: string,
    deviceInfo?: { platform?: string; deviceId?: string; appVersion?: string }
  ) {
    const response = await this.request<TokenResponse & { user: any }>(
      "/api/mobile/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ phone, password, deviceInfo }),
      }
    );

    if (response.success && response.accessToken) {
      await this.setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresIn: response.expiresIn,
      });
    }

    return response;
  }

  async resetPassword(verificationToken: string, password: string) {
    const response = await this.request<TokenResponse & { user: any }>(
      "/api/mobile/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({ verificationToken, password }),
      }
    );

    if (response.success && response.accessToken) {
      await this.setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresIn: response.expiresIn,
      });
    }

    return response;
  }

  async logout() {
    await this.clearTokens();
  }

  // Shift endpoints
  async getCurrentShift() {
    return this.request<{
      shift: {
        id: string;
        status: "open" | "closed" | "stale";
        clockInAt: string;
        clockOutAt?: string;
      } | null;
    }>("/api/mobile/shifts/current", {
      method: "GET",
    });
  }

  async clockIn(data: {
    location: { latitude: number; longitude: number; accuracy: number };
    note?: string;
  }) {
    return this.request<{ shift: any }>("/api/mobile/shifts/clock-in", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async clockOut(data: {
    location: { latitude: number; longitude: number; accuracy: number };
    note?: string;
  }) {
    return this.request<{ shift: any }>("/api/mobile/shifts/clock-out", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getShiftHistory(params?: {
    period?: "week" | "month" | "all";
    limit?: number;
    offset?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.set("period", params.period);
    if (params?.limit) queryParams.set("limit", params.limit.toString());
    if (params?.offset) queryParams.set("offset", params.offset.toString());

    const queryString = queryParams.toString();
    const url = `/api/mobile/shifts/history${
      queryString ? `?${queryString}` : ""
    }`;

    return this.request<{
      shifts: Array<{
        id: string;
        date: string;
        dayOfWeek: string;
        clockIn: string;
        clockOut: string | null;
        duration: number;
        location: string;
        status: "completed" | "active" | "revised" | "pending" | "stale";
        crossedMidnight: boolean;
        wasOutOfRange: boolean;
        breakMinutes: number;
        clockInAt: string;
        clockOutAt: string | null;
        shiftDate: string;
      }>;
      summary: {
        totalHours: number;
        regularHours: number;
        overtimeHours: number;
        shiftsCompleted: number;
        avgPerDay: number;
        activeShifts: number;
      };
      pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
      };
    }>(url, {
      method: "GET",
    });
  }

  // Check-in request endpoints
  async submitCheckInRequest(data: {
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
      timestamp: string;
    };
    reason: string;
    photoUri?: string;
    requestType?: "clock_in" | "clock_out";
    isHistorical?: boolean;
    requestedTime?: string;
  }) {
    return this.request<{
      request: any;
      requestType: "clock_in" | "clock_out";
    }>("/api/mobile/requests", {
      method: "POST",
      body: JSON.stringify({
        location: data.location,
        reason: data.reason,
        requestType: data.requestType,
        isHistorical: data.isHistorical,
        requestedTime: data.requestedTime,
      }),
    });
  }

  async getMyRequests(status?: "pending" | "approved" | "denied") {
    const params = status ? `?status=${status}` : "";
    return this.request<{ requests: any[] }>(
      `/api/mobile/requests/mine${params}`,
      {
        method: "GET",
      }
    );
  }

  // Location endpoints
  async getLocations() {
    return this.request<{
      locations: Array<{
        id: string;
        name: string;
        address?: string;
        latitude: number;
        longitude: number;
        radiusMeters: number;
        isPrimary: boolean;
      }>;
      geofenceSettings: {
        enabled: boolean;
        radiusMeters: number;
        strictMode: boolean;
        requireServerVerification: boolean;
      } | null;
      organization: {
        id: string;
        name: string;
      };
    }>("/api/mobile/locations", {
      method: "GET",
    });
  }

  // FormData request for file uploads (used for photo upload)
  async requestFormData<T = any>(
    endpoint: string,
    formData: FormData
  ): Promise<ApiResponse<T>> {
    const url = `${API_URL}${endpoint}`;

    const headers: HeadersInit = {};

    if (this.accessToken) {
      (headers as Record<string, string>)[
        "Authorization"
      ] = `Bearer ${this.accessToken}`;
    }

    try {
      let response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
      });

      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          (headers as Record<string, string>)[
            "Authorization"
          ] = `Bearer ${this.accessToken}`;
          response = await fetch(url, {
            method: "POST",
            headers,
            body: formData,
          });
        }
      }

      console.log("res", response);

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: "Network error. Please check your connection.",
      };
    }
  }

  async getMe() {
    return this.request<{ user: any }>("/api/mobile/auth/me", {
      method: "GET",
    });
  }

  // Notification endpoints
  async getNotifications(params?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set("limit", params.limit.toString());
    if (params?.offset) queryParams.set("offset", params.offset.toString());
    if (params?.unreadOnly) queryParams.set("unreadOnly", "true");

    const queryString = queryParams.toString();
    const url = `/api/mobile/notifications${
      queryString ? `?${queryString}` : ""
    }`;

    return this.request<{
      notifications: Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        data?: Record<string, any>;
        isRead: boolean;
        createdAt: string;
      }>;
      unreadCount: number;
      pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      };
    }>(url, {
      method: "GET",
    });
  }

  async markNotificationsRead(params: {
    notificationIds?: string[];
    markAllRead?: boolean;
  }) {
    return this.request<{ markedCount: number }>("/api/mobile/notifications", {
      method: "PATCH",
      body: JSON.stringify(params),
    });
  }

  // Push token endpoints
  async registerPushToken(data: {
    token: string;
    deviceId?: string;
    platform: "ios" | "android";
    appVersion?: string;
  }) {
    return this.request<{ tokenId: string; message: string }>(
      "/api/mobile/push-token",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  }

  async removePushToken(params: {
    token?: string;
    deviceId?: string;
    removeAll?: boolean;
  }) {
    return this.request<{ removedCount: number }>("/api/mobile/push-token", {
      method: "DELETE",
      body: JSON.stringify(params),
    });
  }

  // Schedule endpoints
  async getMySchedule() {
    return this.request<{
      hasSchedule: boolean;
      schedule: {
        templateId: string;
        templateName: string;
        templateColor: string;
        slots: Array<{
          id: string;
          dayOfWeek: string;
          startTime: string;
          endTime: string;
          crossesMidnight: boolean;
          breakMinutes: number;
        }>;
        effectiveFrom: string | null;
        effectiveUntil: string | null;
      } | null;
      message?: string;
    }>("/api/mobile/schedules/my", {
      method: "GET",
    });
  }
}

export const api = new ApiClient();

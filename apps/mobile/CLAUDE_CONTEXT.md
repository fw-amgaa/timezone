# Mobile App Quick Reference

> **See `/CLAUDE_CONTEXT.md` at root for full project context (database schema, API endpoints, auth flows).**

## Critical Reminders

1. **Styling**: Use `StyleSheet.create()` ONLY - NativeWind does NOT work
2. **Safe Areas**: Always use `useSafeAreaInsets()`
3. **Animations**: Use MotiView from 'moti'

## File Structure

```
app/
├── _layout.tsx          # Root layout with AuthProvider
├── index.tsx            # Entry, auth state check
├── request.tsx          # Check-in request screen (out-of-range)
├── (auth)/              # Unauthenticated screens
│   ├── login.tsx        # Phone entry + biometric
│   ├── verify.tsx       # 6-digit OTP
│   ├── password.tsx     # Password login
│   ├── set-password.tsx # First-time setup
│   └── reset-password.tsx
└── (tabs)/              # Authenticated screens
    ├── _layout.tsx      # Tab bar (StyleSheet.create)
    ├── index.tsx        # Home/Dashboard
    ├── schedule.tsx
    ├── timesheet.tsx
    └── profile.tsx      # User profile + logout

lib/
├── api.ts               # API client (see methods below)
└── auth.tsx             # AuthProvider + useAuth()
```

## API Methods (`lib/api.ts`)

### Auth
| Method | Purpose |
|--------|---------|
| `api.checkPhone(phone)` | Check phone exists |
| `api.sendOtp(phone)` | Send OTP |
| `api.verifyOtp(phone, code)` | Verify OTP → verificationToken |
| `api.setPassword(token, pwd, deviceInfo)` | Set password (new user) |
| `api.login(phone, pwd, deviceInfo)` | Login → tokens |
| `api.resetPassword(token, pwd)` | Reset password |
| `api.getMe()` | Get current user |
| `api.logout(refreshToken?, logoutAll?)` | Logout |
| `api.refreshTokens()` | Refresh access token |

### Shifts & Requests
| Method | Purpose |
|--------|---------|
| `api.getCurrentShift()` | Get current open shift (if any) |
| `api.clockIn(data)` | Clock in (location) |
| `api.clockOut(data)` | Clock out (location) |
| `api.submitCheckInRequest(data)` | Submit out-of-range request |
| `api.getMyRequests(status?)` | Get user's requests |

## useAuth() Hook

```typescript
const {
  isLoading,           // Initial auth check
  isAuthenticated,     // Logged in?
  user,                // Current user
  setUser,             // Update user
  logout,              // Logout
  biometricsAvailable, // Device supports?
  biometricsEnabled,   // User enabled?
  enableBiometrics,    // (password) => Promise<boolean>
  loginWithBiometrics, // () => Promise<{success, error?}>
  setKeepLoggedIn,     // (value) => Promise<void>
} = useAuth();
```

## Colors

```typescript
primary: "#6366F1"
gradient: ["#312E81", "#4338CA", "#6366F1"]
textDark: "#111827", "#374151"
textLight: "#6B7280", "#9CA3AF"
error: "#EF4444"
success: "#10B981"
border: "#E5E7EB"
bgLight: "#F9FAFB"
```

---

**Last Updated**: 2026-01-12

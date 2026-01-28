# TimeZone - Development Context

> **IMPORTANT**: Claude must read this file first before making any changes. Update this file when adding new features or modifying existing ones.

## Project Overview

**TimeZone** is a workforce time tracking application with:

- **Web App** (`apps/web`) - Next.js admin dashboard for managers
- **Mobile App** (`apps/mobile`) - React Native/Expo app for employees
- **Shared Packages** - Database, utilities

## Monorepo Structure

```
timezone/
├── apps/
│   ├── web/                    # Next.js 14+ web app
│   │   └── src/
│   │       ├── app/            # App router pages
│   │       │   └── api/        # API routes
│   │       │       ├── auth/   # Better Auth (web)
│   │       │       ├── mobile/ # Mobile API endpoints
│   │       │       ├── shifts/ # Shift management
│   │       │       └── requests/ # Check-in requests
│   │       └── lib/            # Utilities
│   │           └── mobile-auth.ts # JWT auth helpers
│   └── mobile/                 # React Native/Expo app
│       ├── app/                # Expo Router pages
│       │   ├── (auth)/         # Auth screens
│       │   └── (tabs)/         # Main app screens
│       ├── lib/                # API client, auth context
│       └── CLAUDE_CONTEXT.md   # Mobile-specific context
├── packages/
│   ├── database/               # Drizzle ORM + PostgreSQL
│   │   └── src/schema/         # Table definitions
│   └── utils/                  # Shared utilities
└── CLAUDE_CONTEXT.md           # This file
```

---

## Tech Stacks

### Web App (`apps/web`)

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Auth**: Better Auth (for web sessions)
- **Database**: Drizzle ORM + PostgreSQL
- **Styling**: Tailwind CSS

### Mobile App (`apps/mobile`)

- **Framework**: React Native + Expo (Expo Router)
- **Language**: TypeScript
- **Auth**: JWT (access + refresh tokens)
- **Styling**: `StyleSheet.create()` (**NOT NativeWind**)
- **Animations**: Moti
- **Icons**: @expo/vector-icons (Ionicons)
- **Storage**: expo-secure-store
- **Biometrics**: expo-local-authentication

### Database (`packages/database`)

- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **Exports**: `@timezone/database`, `@timezone/database/schema`

---

## Database Schema

### Tables Overview

| Table                    | Description                             |
| ------------------------ | --------------------------------------- |
| `users`                  | All users (employees, managers, admins) |
| `organizations`          | Companies/businesses                    |
| `orgLocations`           | Geofenced work locations                |
| `shifts`                 | Time tracking records                   |
| `breaks`                 | Break periods within shifts             |
| `checkInRequests`        | Out-of-range clock requests             |
| `otpVerifications`       | Mobile OTP codes                        |
| `refreshTokens`          | Mobile JWT refresh tokens               |
| `sessions`               | Web sessions (Better Auth)              |
| `accounts`               | OAuth accounts (Better Auth)            |
| `verifications`          | Email verification tokens               |
| `notifications`          | In-app notification records             |
| `pushTokens`             | Expo push notification tokens           |
| `teams`                  | Employee groupings                      |
| `teamMembers`            | Many-to-many users↔teams               |
| `scheduleTemplates`      | Recurring schedule patterns             |
| `scheduleSlots`          | Time slots within templates             |
| `scheduleAssignments`    | Link templates to teams/users           |
| `scheduledNotifications` | Idempotency tracking for reminders      |

### Enums

```typescript
// User roles
userRoleEnum: "super_admin" | "org_admin" | "org_manager" | "employee";

// Subscription tiers
subscriptionTierEnum: "free" | "starter" | "professional" | "enterprise";

// Shift status
shiftStatusEnum: "open" | "closed" | "stale" | "pending_revision" | "revised";

// Request status
requestStatusEnum: "pending" | "approved" | "denied" | "auto_expired";

// Location verification
locationStatusEnum: "in_range" |
  "out_of_range" |
  "unknown" |
  "spoofing_detected";

// OTP status
otpStatusEnum: "pending" | "verified" | "expired" | "max_attempts";

// Notification types
notificationTypeEnum: "request_approved" | "request_denied" | "schedule_update" |
  "weekly_summary" | "app_update" | "clock_in_reminder" | "clock_out_reminder" | "manager_alert";

// Day of week (for schedules)
dayOfWeekEnum: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

// Team member roles
teamRoleEnum: "lead" | "member";

// Scheduled notification status
scheduledNotificationStatusEnum: "pending" | "sent" | "skipped" | "failed";
```

### Key Table Schemas

#### `users`

```typescript
{
  id: uuid,
  organizationId: uuid | null,  // null for super_admin
  role: userRoleEnum,
  firstName: string,
  lastName: string,
  name: string,
  position?: string,
  email?: string (unique),
  phone?: string (unique),
  phoneVerified: boolean,
  passwordHash?: string,
  preferences: UserPreferences (jsonb),
  isActive: boolean,
  createdAt, updatedAt
}
```

#### `organizations`

```typescript
{
  id: uuid,
  name: string,
  slug: string (unique),
  latitude?, longitude?,       // Primary location
  geofenceSettings: GeofenceSettings (jsonb),
  localeSettings: OrgLocaleSettings (jsonb),
  shiftPolicySettings: ShiftPolicySettings (jsonb),
  subscriptionTier: enum,
  maxEmployees: number,
  isActive: boolean,
  createdAt, updatedAt
}
```

#### `shifts`

```typescript
{
  id: uuid,
  organizationId: uuid,
  userId: uuid,
  locationId?: uuid,
  status: shiftStatusEnum,
  clockInAt: timestamp,
  clockInLocation?: CapturedLocation (jsonb),
  clockInLocationStatus?: locationStatusEnum,
  clockOutAt?: timestamp,
  clockOutLocation?: CapturedLocation (jsonb),
  durationMinutes?: number,
  breakMinutes: number (default 0),
  shiftDate: timestamp,        // Attributed date for reporting
  isRevised: boolean,
  wasOffline: boolean,
  createdAt, updatedAt
}
```

#### `refreshTokens` (Mobile Auth)

```typescript
{
  id: uuid,
  userId: uuid,
  token: string (unique),
  deviceInfo?: { platform, deviceId, appVersion },
  expiresAt: timestamp,
  lastUsedAt?: timestamp,
  createdAt
}
```

#### `otpVerifications`

```typescript
{
  id: uuid,
  phone: string,
  code: string (6 digits),
  status: otpStatusEnum,
  attempts: string,
  expiresAt: timestamp,
  verifiedAt?: timestamp,
  createdAt
}
```

#### `notifications`

```typescript
{
  id: uuid,
  userId: uuid,
  organizationId: uuid,
  type: notificationTypeEnum,
  title: string,
  message: text,
  data?: NotificationData (jsonb),  // { screen, requestId, templateId, etc. }
  isRead: boolean,
  readAt?: timestamp,
  pushSent: boolean,
  pushSentAt?: timestamp,
  pushError?: string,
  createdAt
}
```

#### `pushTokens`

```typescript
{
  id: uuid,
  userId: uuid,
  token: string (unique),  // Expo push token
  deviceId?: string,
  platform?: string,
  appVersion?: string,
  isActive: boolean,
  failureCount: number,
  lastFailureAt?: timestamp,
  createdAt, updatedAt
}
```

#### `teams`

```typescript
{
  id: uuid,
  organizationId: uuid,
  name: string,
  description?: text,
  color: string (hex),
  isActive: boolean,
  createdAt, updatedAt
}
```

#### `teamMembers`

```typescript
{
  id: uuid,
  teamId: uuid,
  userId: uuid,
  role: teamRoleEnum,  // "lead" | "member"
  createdAt
}
```

#### `scheduleTemplates`

```typescript
{
  id: uuid,
  organizationId: uuid,
  name: string,
  description?: text,
  color: string (hex),
  isActive: boolean,
  createdBy?: uuid,
  createdAt, updatedAt
}
```

#### `scheduleSlots`

```typescript
{
  id: uuid,
  templateId: uuid,
  dayOfWeek: dayOfWeekEnum,
  startTime: string (HH:MM),
  endTime: string (HH:MM),
  crossesMidnight: boolean,  // For night shifts (e.g., 18:00-04:00)
  breakMinutes: number,
  createdAt
}
```

#### `scheduleAssignments`

```typescript
{
  id: uuid,
  templateId: uuid,
  teamId?: uuid,    // Either teamId OR userId
  userId?: uuid,
  effectiveFrom?: timestamp,
  effectiveUntil?: timestamp,
  isActive: boolean,
  createdBy?: uuid,
  createdAt, updatedAt
}
```

---

## API Endpoints

### Mobile Auth (`/api/mobile/auth/`)

| Endpoint          | Method | Auth | Description                                          |
| ----------------- | ------ | ---- | ---------------------------------------------------- |
| `/check-phone`    | POST   | No   | Check if phone exists, has password                  |
| `/send-otp`       | POST   | No   | Send 6-digit OTP to phone                            |
| `/verify-otp`     | POST   | No   | Verify OTP, return verification token                |
| `/set-password`   | POST   | No   | Set password for new user (needs verification token) |
| `/login`          | POST   | No   | Login with phone + password                          |
| `/reset-password` | POST   | No   | Reset password (needs verification token)            |
| `/refresh`        | POST   | No   | Refresh access token using refresh token             |
| `/me`             | GET    | Yes  | Get current user profile                             |
| `/logout`         | POST   | Yes  | Invalidate refresh token(s)                          |

### Mobile Shifts (`/api/mobile/shifts/`)

| Endpoint     | Method | Auth | Description                                              |
| ------------ | ------ | ---- | -------------------------------------------------------- |
| `/current`   | GET    | JWT  | Get user's current open shift (if any)                   |
| `/clock-in`  | POST   | JWT  | Clock in (within geofence required)                      |
| `/clock-out` | POST   | JWT  | Clock out from current shift                             |
| `/history`   | GET    | JWT  | Get shift history (query: period=week/month/all, limit)  |

### Mobile Locations (`/api/mobile/locations/`)

| Endpoint | Method | Auth | Description                               |
| -------- | ------ | ---- | ----------------------------------------- |
| `/`      | GET    | JWT  | Get org locations for geofencing on map   |

### Mobile Requests (`/api/mobile/requests/`)

| Endpoint | Method | Auth | Description                                                        |
| -------- | ------ | ---- | ------------------------------------------------------------------ |
| `/`      | POST   | JWT  | Create check-in request (supports historical requests with date)   |
| `/`      | GET    | JWT  | Get user's own requests (optional `status` query)                  |

### Mobile Notifications (`/api/mobile/notifications/`)

| Endpoint | Method | Auth | Description                                           |
| -------- | ------ | ---- | ----------------------------------------------------- |
| `/`      | GET    | JWT  | List notifications (pagination, `unreadOnly` filter)  |
| `/`      | PATCH  | JWT  | Mark as read (specific `ids` array or `all: true`)    |

### Mobile Push Tokens (`/api/mobile/push-token/`)

| Endpoint | Method | Auth | Description                         |
| -------- | ------ | ---- | ----------------------------------- |
| `/`      | POST   | JWT  | Register Expo push token            |
| `/`      | DELETE | JWT  | Remove push token (on logout)       |

### Mobile Schedules (`/api/mobile/schedules/`)

| Endpoint | Method | Auth | Description                         |
| -------- | ------ | ---- | ----------------------------------- |
| `/my`    | GET    | JWT  | Get current user's assigned schedule|

### Web Shifts (`/api/shifts/`)

| Endpoint     | Method   | Auth    | Description                               |
| ------------ | -------- | ------- | ----------------------------------------- |
| `/clock-in`  | POST     | Session | Clock in (creates open shift)             |
| `/clock-out` | POST     | Session | Clock out (closes most recent open shift) |
| `/stale`     | GET/POST | Session | Handle stale shifts (>16 hours)           |

### Web Requests (`/api/requests/`)

| Endpoint | Method | Auth    | Description                                                          |
| -------- | ------ | ------- | -------------------------------------------------------------------- |
| `/`      | GET    | Session | Get requests for org (`status=pending` or `status=resolved`)         |
| `/`      | PATCH  | Session | Review request (`action: approve/deny`, `requestId`, `denialReason`) |

### Web Locations (`/api/locations/`)

| Endpoint | Method | Auth    | Description                      |
| -------- | ------ | ------- | -------------------------------- |
| `/`      | GET    | Session | Get all locations for org        |
| `/`      | POST   | Session | Create new location (admin only) |
| `/`      | PATCH  | Session | Update location (admin only)     |
| `/`      | DELETE | Session | Delete location (admin only)     |

### Web Stale Shifts (`/api/shifts/stale/`)

| Endpoint | Method | Auth    | Description                              |
| -------- | ------ | ------- | ---------------------------------------- | -------------- |
| `/`      | GET    | Session | Get all stale shifts (>16h open) for org |
| `/`      | POST   | Session | Resolve stale shift (`resolution: forgot | actual_hours`) |

### Web Teams (`/api/teams/`)

| Endpoint         | Method | Auth    | Description                    |
| ---------------- | ------ | ------- | ------------------------------ |
| `/`              | GET    | Session | List all teams for org         |
| `/`              | POST   | Session | Create new team                |
| `/[id]`          | PATCH  | Session | Update team                    |
| `/[id]`          | DELETE | Session | Delete team                    |
| `/[id]/members`  | POST   | Session | Add member to team             |
| `/[id]/members`  | DELETE | Session | Remove member from team        |

### Web Schedules (`/api/schedules/`)

| Endpoint              | Method | Auth    | Description                     |
| --------------------- | ------ | ------- | ------------------------------- |
| `/templates`          | GET    | Session | List all schedule templates     |
| `/templates`          | POST   | Session | Create new template with slots  |
| `/templates/[id]`     | GET    | Session | Get template with slots         |
| `/templates/[id]`     | PATCH  | Session | Update template and slots       |
| `/templates/[id]`     | DELETE | Session | Delete template                 |
| `/assignments`        | GET    | Session | List schedule assignments       |
| `/assignments`        | POST   | Session | Assign template to team/user    |
| `/assignments`        | DELETE | Session | Remove assignment               |

### Cron Jobs (`/api/cron/`)

| Endpoint               | Method   | Auth        | Description                              |
| ---------------------- | -------- | ----------- | ---------------------------------------- |
| `/check-notifications` | GET/POST | CRON_SECRET | Run clock-in/out reminder checks         |
| `/weekly-summary`      | GET/POST | CRON_SECRET | Send weekly summary notifications        |

---

## Mobile Auth System

### JWT Token Flow

1. **Access Token**: Short-lived (15 min), JWT stored in memory
2. **Refresh Token**: Long-lived (30 days), random string stored in SecureStore + DB

### Token Storage Keys (Mobile)

```typescript
"timezone_access_token"; // JWT access token
"timezone_refresh_token"; // Refresh token
"timezone_biometric_password"; // Password for biometric login
"timezone_keep_logged_in"; // Preference flag
```

### Auth Helper Functions (`lib/mobile-auth.ts`)

```typescript
// Create session (returns accessToken, refreshToken, expiresIn)
createMobileSession(userId: string, deviceInfo?: DeviceInfo): Promise<MobileSession>

// Verify access token
verifyAccessToken(token: string): TokenPayload | null

// Create verification token for password setup
createVerificationToken(phone: string): string

// Verify verification token
verifyVerificationToken(token: string): { phone: string } | null

// Validate refresh token
validateRefreshToken(token: string): Promise<{ userId, tokenId } | null>

// Authenticate request (middleware helper)
authenticateRequest(request: NextRequest): Promise<{ user, error }>

// Remove sensitive fields from user
sanitizeUser(user: any): SafeUser
```

---

## Auth Flows

### First-time User

```
login.tsx → verify.tsx (OTP) → set-password.tsx → (tabs)
```

### Returning User

```
login.tsx → password.tsx → (tabs)
```

### Biometric Login

```
login.tsx (tap biometric) → (tabs)
```

### Forgot Password

```
password.tsx (tap forgot) → verify.tsx (OTP) → reset-password.tsx → (tabs)
```

---

## Check-In Request Flow

### Overview

When an employee is out of the geofenced work location, they can submit a check-in request instead of a normal clock-in/clock-out.

### Mobile Flow

1. User opens request screen (`app/request.tsx`)
2. App fetches current location using `expo-location`
3. App checks if user has open shift via `/api/mobile/shifts/current`
4. Request type auto-determined: `clock_in` (no open shift) or `clock_out` (has open shift)
5. User provides reason (required, min 10 chars) and optional photo
6. Submit to `/api/mobile/requests` (POST)
7. Request created with `pending` status, expires in 24 hours

### Manager Flow (Web Dashboard)

1. Manager views `/dashboard/requests` page
2. Fetches pending/resolved requests from `/api/requests`
3. Can approve or deny requests
4. On approve: actual shift is created (clock-in) or closed (clock-out)
5. On deny: denial reason required

### Request States

- `pending` - Awaiting manager review
- `approved` - Approved, shift created/closed
- `denied` - Denied with reason
- `auto_expired` - Expired after 24 hours without review

---

## Web Dashboard Pages

### `/dashboard` - Main Dashboard

- **Real-time stats**: Active employees, today's hours, pending requests, stale shifts
- **Recent activity**: Last 10 shift events
- **Pending requests**: Quick approve/deny from dashboard
- **Stale shift alerts**: Resolve shifts open >16 hours

### `/dashboard/time-entries` - Time Entries

- **Table view**: All shifts with filtering
- **Filters**: Date range, status (open/closed/revised/stale), search
- **Stats**: Total hours, completed shifts, in-progress, stale count
- **Night shift indicator**: Moon icon for shifts crossing midnight

### `/dashboard/requests` - Check-In Requests

- **Two tabs**: Pending / Resolved
- **Actions**: Approve (creates shift), Deny (requires reason)
- **View Map**: Opens Google Maps with request location

### `/dashboard/locations` - Work Locations (Geofencing)

- **Purpose**: Define geofenced areas where employees can clock in/out normally
- **CRUD**: Add, edit, delete work locations
- **Fields**: Name, address, lat/lng coordinates, radius (50-5000m)
- **Primary location**: Designate headquarters
- **How it works**: Employees within radius clock in normally; outside requires request

### `/dashboard/reports` - Analytics & Reports

- **Hours by Employee**: Weekly/monthly hours with progress bars
- **By Location**: Hours and shifts per location
- **Requests Summary**: Approval rate, pending/approved/denied counts
- **Overtime Report**: Employees exceeding 40h/week

### `/dashboard/employees` - Employee Management

- **Add employees**: Name, phone, position, role
- **Status badges**: Clocked In, Clocked Out, Registered
- **Server actions**: Real database CRUD

### `/dashboard/organizations` - Organization Management (Super Admin)

- **Create org**: Full form with admin setup
- **Manage**: Activate/deactivate, edit, delete
- **Subscription tiers**: Free, Starter, Professional, Enterprise

### `/dashboard/teams` - Team Management

- **Team list**: View all teams with member counts
- **Create/Edit**: Name, description, color picker
- **Member management**: Add/remove employees from teams
- **Role assignment**: Lead or member role per team

### `/dashboard/schedules` - Schedule Templates

- **Template list**: Color-coded schedule cards with assignment counts
- **Template editor**: Name, description, color, weekly time slots
- **Time slot editor**: Day, start/end time, night shift toggle (crossesMidnight), break duration
- **Night shift support**: Handles shifts like 18:00-04:00 that cross midnight
- **Assignments**: Assign templates to teams or individual users
- **Visual weekly preview**: See schedule at a glance

---

## Push Notification System

### Overview

TimeZone uses Expo Push Notifications for mobile alerts. Notifications are stored in the database and sent via Expo's push service.

### Notification Types

| Type               | Description                                        |
| ------------------ | -------------------------------------------------- |
| `request_approved` | Check-in request approved by manager               |
| `request_denied`   | Check-in request denied by manager                 |
| `schedule_update`  | Schedule template or assignment changed            |
| `weekly_summary`   | Weekly work hours summary                          |
| `app_update`       | General app announcements                          |
| `clock_in_reminder`| Reminder to clock in before shift starts           |
| `clock_out_reminder`| Reminder to clock out after shift ends            |
| `manager_alert`    | Alert to manager when employee is late             |

### Mobile Setup (expo-notifications)

```typescript
// apps/mobile/lib/notifications.ts
registerForPushNotifications()  // Request permission, get token, send to backend
unregisterPushToken()           // Called on logout
useNotificationListeners()      // Handle notification taps, deep linking
useUnreadNotificationCount()    // Badge count hook
```

### Android Channels

- `schedule-reminders`: Clock-in/out reminders (high priority)
- `request-updates`: Request approval/denial
- `schedule-updates`: Schedule changes
- `weekly-summaries`: Weekly reports
- `general`: App updates

---

## Scheduler Service

### Location

`/apps/web/src/lib/scheduler/`

### Notification Timing

| Trigger                  | Notification Type       | Recipients              |
| ------------------------ | ----------------------- | ----------------------- |
| 15 min before shift      | `clock_in_reminder`     | Scheduled employee      |
| 5 min before shift       | `clock_in_reminder`     | Scheduled employee      |
| At shift start (not in)  | `clock_in_reminder`     | Scheduled employee      |
| 15 min after start       | `clock_in_reminder` + `manager_alert` | Employee + managers |
| 15 min after end (still in) | `clock_out_reminder` | Employee                |
| Sunday evening           | `weekly_summary`        | All employees           |

### Key Files

```
scheduler/
  index.ts          - Main entry, exports runNotificationChecks()
  check-clock-in.ts - Clock-in reminder logic
  check-clock-out.ts - Clock-out reminder logic
  weekly-summary.ts - Weekly summary generation
  push-sender.ts    - Expo Push API integration
  utils.ts          - Timezone, time calculation helpers
```

### External Cron Setup

The scheduler requires external cron jobs to trigger the API endpoints:

```bash
# Every minute - check clock-in/out reminders
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.com/api/cron/check-notifications

# Sunday 6 PM - send weekly summaries
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.com/api/cron/weekly-summary
```

### Night Shift Handling

Schedules support `crossesMidnight: true` for night shifts (e.g., 18:00-04:00):
- Start day: Monday 18:00
- End day: Tuesday 04:00
- Reminders sent appropriately across day boundaries

---

## Coding Conventions

### Mobile (React Native)

- **ALWAYS** use `StyleSheet.create()` - NativeWind does NOT work
- Use `useSafeAreaInsets()` for safe areas
- Use MotiView for animations
- Color palette: Primary #6366F1, Gradient ["#312E81", "#4338CA", "#6366F1"]

### Web (Next.js)

- Use Tailwind CSS for styling
- API routes use Zod for validation
- Better Auth for web sessions

### Database

- Import from `@timezone/database` for client/helpers
- Import from `@timezone/database/schema` for table schemas
- Use Drizzle query syntax

---

## Common Import Patterns

### Mobile App

```typescript
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { StyleSheet, View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
```

### Web API Routes

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and, gt } from "@timezone/database";
import { users, shifts, organizations } from "@timezone/database/schema";
import { authenticateRequest, sanitizeUser } from "@/lib/mobile-auth";
```

---

## Environment Variables

### Web App

```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
BETTER_AUTH_SECRET=...
```

### Mobile App

```
API_BASE_URL=http://192.168.1.71:3000/api/mobile  # Development
```

---

**Last Updated**: 2026-01-18
**Recent Changes**:

- **Push Notification System** - Full Expo push notifications with expo-notifications
  - Mobile notification registration and handling
  - Deep linking from notification taps
  - Android notification channels
  - Push token management with failure tracking
- **Teams Management** - Employee groupings with lead/member roles
  - Web dashboard page `/dashboard/teams`
  - Full CRUD API at `/api/teams`
- **Schedule Templates** - Recurring weekly schedules
  - Web dashboard page `/dashboard/schedules`
  - Support for night shifts crossing midnight (18:00-04:00)
  - Time slots per day of week with break minutes
  - Assign to teams or individual users
- **Scheduler Service** - Automated notification reminders
  - Clock-in reminders: 15 min before, 5 min before, at time, 15 min after (late alert)
  - Clock-out reminders: 15 min after scheduled end
  - Manager alerts when employee is late
  - Weekly summary generation
  - Timezone-aware scheduling per organization
- **Event-based Notifications** - Triggered on key events
  - Request approved/denied notifications
  - Schedule update notifications
- **Mobile Notifications Screen** - Real data integration
  - Pagination and unread filtering
  - Mark as read (individual or all)
  - Deep linking to relevant screens
- **Sidebar Updated** - Added Teams and Schedules navigation items
- **Database Schema Additions**:
  - `notifications` - In-app notification records
  - `pushTokens` - Expo push tokens per device
  - `teams` / `teamMembers` - Team groupings
  - `scheduleTemplates` / `scheduleSlots` / `scheduleAssignments` - Recurring schedules
  - `scheduledNotifications` - Idempotency tracking
  - New enums: notificationTypeEnum, dayOfWeekEnum, teamRoleEnum, scheduledNotificationStatusEnum

**Previous Changes**:

- Connected History tab to real data - fetches shifts from API with week/month/all filtering
- Added `/api/mobile/shifts/history` endpoint - returns shift history with summary stats
- Added real map to mobile home screen using react-native-maps (Apple Maps on iOS - free)
- Real-time location tracking with live geofence status updates
- Geofence radius visualization - circles displayed on map for each org location
- Added `/api/mobile/locations` endpoint - fetches org locations for geofencing
- Added `/api/mobile/shifts/clock-in` endpoint - clock in with location verification
- Added `/api/mobile/shifts/clock-out` endpoint - clock out with location verification
- Pending request state handling - button shows "Pending" when user has pending clock-in request
- Historical request feature - submit clock-in/out requests for past dates (up to 30 days)
- Request screen enhanced with toggle for historical mode, date/time picker, and request type selector
- Added logo to web app (favicon, sidebar, auth pages)
- Made sidebar requests badge dynamic (fetched from database)
- Connected dashboard page to real data (stats, activity, stale shifts)
- Connected time entries page to real data with filtering
- Created locations page for geofenced work locations (CRUD)
- Created comprehensive reports page (4 report types)
- Implemented stale shift resolution (forgot / actual hours)
- Added `/api/locations` endpoint (GET, POST, PATCH, DELETE)
- Updated `/api/shifts/stale` with real database integration
- Implemented complete check-in request flow (mobile to web dashboard)
- Added `/api/mobile/shifts/current` endpoint
- Added `/api/mobile/requests` endpoint (POST create, GET list)
- Updated `/api/requests` with real database integration (GET, PATCH)
- Connected web dashboard requests page with approve/deny functionality
- Updated profile logout to use actual auth context
- Fixed bottom tab bar styling (NativeWind → StyleSheet)
- Completed mobile auth screens (StyleSheet conversion)

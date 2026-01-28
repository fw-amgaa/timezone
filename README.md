# Timezone

High-precision, multi-tenant SaaS for workforce time tracking. Built for hospitals, factories, and anywhere shifts cross midnight.

## Features

- **Midnight Shift Handling**: Seamlessly track shifts that cross midnight with intelligent linkage algorithm
- **Precision Geofencing**: Server-side GPS verification prevents spoofing with configurable radius per location
- **Multi-Tenant Architecture**: Isolated data per organization with custom settings and workflows
- **Offline Support**: Queue clock events when offline, sync automatically when back online
- **Biometric Auth**: Face ID / Touch ID support for quick employee access
- **Approval Workflows**: Out-of-range check-in requests with manager approval flow
- **Stale Shift Resolution**: "Forgot to clock out" detection with employee resolution and manager review

## Tech Stack

### Architecture
- **Monorepo**: Turborepo with pnpm workspaces

### Web (Admin/Manager Dashboard)
- Next.js 15+ (App Router)
- Shadcn UI (Mira preset)
- Tailwind CSS v4
- Phosphor Icons

### Mobile (Employee App)
- Expo SDK 52+
- React Native
- NativeWind v4
- Moti (animations)
- Expo Router

### Backend/Database
- PostgreSQL with Drizzle ORM
- Shared schema with tenant-ID isolation
- Better Auth (web) + JWT/OTP (mobile)

## Project Structure

```
timezone/
├── apps/
│   ├── web/          # Next.js admin dashboard
│   └── mobile/       # Expo employee app
├── packages/
│   ├── database/     # Drizzle schema & client
│   └── utils/        # Shared utilities (shift calc, geofence, etc.)
├── turbo.json
└── package.json
```

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

### Installation

```bash
# Clone and install dependencies
git clone <repo-url>
cd timezone
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL and secrets

# Generate database types
pnpm db:generate

# Push schema to database
pnpm db:push
```

### Development

```bash
# Start all apps in parallel
pnpm dev

# Or start individually
pnpm dev:web    # Web dashboard on http://localhost:3000
pnpm dev:mobile # Expo app (scan QR with Expo Go)

# Database studio
pnpm db:studio
```

### Testing

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter=@timezone/utils test
```

## Core Workflows

### 1. Midnight Shift Linkage

When clocking out, the system finds the most recent OPEN shift and calculates duration correctly across midnight:

```typescript
// Example: 8 PM to 6 AM = 10 hours
const result = calculateShiftDuration(
  "2024-01-15T20:00:00Z",
  "2024-01-16T06:00:00Z"
);
// result.totalMinutes = 600
// result.crossedMidnight = true
// result.attributedDate = "2024-01-15" (start date)
```

### 2. Geofence Verification

```typescript
// Client-side check (for UI feedback)
const result = checkGeofence(userLocation, orgGeofence);
// result.isWithinRange, result.distanceMeters, result.status

// Server-side verification (anti-spoofing)
const verification = serverVerifyLocation(
  reportedLocation,
  geofence,
  { maxAcceptableAccuracy: 100 }
);
// verification.verified, verification.flags
```

### 3. Out-of-Range Request Flow

1. Employee tries to clock in outside geofence
2. App shows "Submit Request" instead of "Clock In"
3. Employee enters reason
4. Manager sees pending request in dashboard
5. Manager approves/denies
6. If approved, shift is created

### 4. Stale Shift Resolution

1. Shift open > 16 hours marked as "stale"
2. On next app open, employee sees resolution screen
3. Employee enters estimated clock-out time and reason
4. Manager reviews and approves
5. Shift updated with "revised" status

## Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#6366F1` | Actions, buttons, accents |
| Deep BG | `#312E81` | Dark sections, headers |
| Success | `#10B981` | Clocked in, approved |
| Warning | `#FB7185` | Out of range, pending |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Auth secret (min 32 chars) |
| `TWILIO_*` | SMS OTP for mobile auth |
| `NEXT_PUBLIC_APP_URL` | Web app URL |
| `EXPO_PUBLIC_API_URL` | API URL for mobile |

## API Endpoints

### Shifts
- `POST /api/shifts/clock-in` - Clock in with location
- `POST /api/shifts/clock-out` - Clock out (finds open shift)
- `GET /api/shifts/stale` - Check for stale shifts
- `POST /api/shifts/stale` - Submit stale shift resolution

### Requests
- `GET /api/requests` - List check-in requests
- `POST /api/requests` - Create out-of-range request
- `PATCH /api/requests` - Approve/deny request

## License

MIT

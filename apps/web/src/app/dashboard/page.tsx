import { db, eq, and, desc, sql, gt, lt } from "@timezone/database";
import { shifts, users, checkInRequests } from "@timezone/database/schema";
import { requireAuth } from "@/lib/auth-server";
import { DashboardClient } from "./dashboard-client";

async function getDashboardData(organizationId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sixteenHoursAgo = new Date(now.getTime() - 16 * 60 * 60 * 1000);

  // Get all data in parallel
  const [
    activeEmployees,
    todayShifts,
    pendingRequests,
    staleShifts,
    recentActivity,
  ] = await Promise.all([
    // Active employees (currently clocked in)
    db.query.shifts.findMany({
      where: and(
        eq(shifts.organizationId, organizationId),
        eq(shifts.status, "open")
      ),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),

    // Today's shifts (for hours calculation)
    db.query.shifts.findMany({
      where: and(
        eq(shifts.organizationId, organizationId),
        gt(shifts.clockInAt, todayStart)
      ),
      columns: {
        durationMinutes: true,
        clockInAt: true,
        clockOutAt: true,
        status: true,
      },
    }),

    // Pending requests
    db.query.checkInRequests.findMany({
      where: and(
        eq(checkInRequests.organizationId, organizationId),
        eq(checkInRequests.status, "pending")
      ),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [desc(checkInRequests.createdAt)],
      limit: 5,
    }),

    // Stale shifts (open > 16 hours)
    db.query.shifts.findMany({
      where: and(
        eq(shifts.organizationId, organizationId),
        eq(shifts.status, "open"),
        lt(shifts.clockInAt, sixteenHoursAgo)
      ),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        location: {
          columns: {
            name: true,
          },
        },
      },
      orderBy: [shifts.clockInAt],
    }),

    // Recent activity (last 10 shifts/requests)
    db.query.shifts.findMany({
      where: eq(shifts.organizationId, organizationId),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        location: {
          columns: {
            name: true,
          },
        },
      },
      orderBy: [desc(shifts.updatedAt)],
      limit: 10,
    }),
  ]);

  // Calculate today's hours
  let totalMinutesToday = 0;
  todayShifts.forEach((shift) => {
    if (shift.durationMinutes) {
      totalMinutesToday += shift.durationMinutes;
    } else if (shift.status === "open" && shift.clockInAt) {
      // For open shifts, calculate duration up to now
      totalMinutesToday += Math.round(
        (now.getTime() - shift.clockInAt.getTime()) / 60000
      );
    }
  });

  return {
    stats: {
      activeEmployees: activeEmployees.length,
      hoursToday: (totalMinutesToday / 60).toFixed(1),
      pendingRequests: pendingRequests.length,
      staleShifts: staleShifts.length,
    },
    pendingRequests: pendingRequests.map((r) => ({
      id: r.id,
      user: {
        name: `${r.user.firstName} ${r.user.lastName}`,
        initials: `${r.user.firstName[0]}${r.user.lastName[0]}`,
      },
      type: r.requestType,
      reason: r.reason,
      distance: r.distanceFromGeofence
        ? `${r.distanceFromGeofence}m`
        : "Unknown",
      submittedAt: r.createdAt.toISOString(),
    })),
    staleShifts: staleShifts.map((s) => {
      const durationMs = now.getTime() - s.clockInAt.getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      return {
        id: s.id,
        user: {
          name: `${s.user.firstName} ${s.user.lastName}`,
          initials: `${s.user.firstName[0]}${s.user.lastName[0]}`,
        },
        clockedInAt: s.clockInAt.toISOString(),
        duration: `${hours}h ${minutes}m`,
        location: s.location?.name || "Unknown Location",
      };
    }),
    recentActivity: recentActivity.map((s) => ({
      id: s.id,
      user: {
        name: `${s.user.firstName} ${s.user.lastName}`,
        initials: `${s.user.firstName[0]}${s.user.lastName[0]}`,
      },
      action:
        s.status === "open"
          ? "clocked_in"
          : s.status === "closed"
            ? "clocked_out"
            : s.status === "stale"
              ? "stale"
              : "shift_completed",
      location: s.location?.name || "Unknown",
      time: s.updatedAt.toISOString(),
      duration: s.durationMinutes
        ? `${Math.floor(s.durationMinutes / 60)}h ${s.durationMinutes % 60}m`
        : undefined,
    })),
  };
}

export default async function DashboardPage() {
  const session = await requireAuth();

  // Get user's organization
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { organizationId: true },
  });

  if (!user?.organizationId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No organization found</p>
      </div>
    );
  }

  const dashboardData = await getDashboardData(user.organizationId);

  return <DashboardClient data={dashboardData} />;
}

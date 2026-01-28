import { db, eq, and, desc, gte, lte } from "@timezone/database";
import { shifts, users } from "@timezone/database/schema";
import { requireAuth } from "@/lib/auth-server";
import { TimeEntriesClient } from "./time-entries-client";

async function getTimeEntries(organizationId: string) {
  // Get shifts from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const allShifts = await db.query.shifts.findMany({
    where: and(
      eq(shifts.organizationId, organizationId),
      gte(shifts.clockInAt, thirtyDaysAgo)
    ),
    with: {
      user: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
        },
      },
      location: {
        columns: {
          name: true,
        },
      },
    },
    orderBy: [desc(shifts.clockInAt)],
    limit: 200,
  });

  const now = new Date();

  return allShifts.map((shift) => {
    // Check if shift crossed midnight
    const clockIn = new Date(shift.clockInAt);
    const clockOut = shift.clockOutAt ? new Date(shift.clockOutAt) : null;
    const crossedMidnight =
      clockOut && clockIn.toDateString() !== clockOut.toDateString();

    // Calculate hours open for stale shifts
    let hoursOpen: number | undefined;
    if (shift.status === "open" || shift.status === "stale") {
      hoursOpen = Math.floor(
        (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
      );
    }

    // Format times
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    };

    let clockOutDisplay: string | null = null;
    if (clockOut) {
      clockOutDisplay = formatTime(clockOut);
      if (crossedMidnight) {
        clockOutDisplay += " (+1)";
      }
    } else if (shift.status === "open") {
      clockOutDisplay = "In Progress";
    } else if (shift.status === "stale") {
      clockOutDisplay = "Stale";
    }

    return {
      id: shift.id,
      user: {
        id: shift.user.id,
        name: `${shift.user.firstName} ${shift.user.lastName}`,
        initials: `${shift.user.firstName[0]}${shift.user.lastName[0]}`,
        position: shift.user.position || "Employee",
      },
      date: clockIn.toISOString().split("T")[0],
      clockIn: formatTime(clockIn),
      clockOut: clockOutDisplay,
      duration: shift.durationMinutes,
      location: shift.location?.name || "Unknown",
      status: shift.status,
      crossedMidnight: crossedMidnight ?? false,
      hoursOpen,
      isRevised: shift.isRevised ?? false,
      clockInLocationStatus: shift.clockInLocationStatus,
      clockOutLocationStatus: shift.clockOutLocationStatus,
    };
  });
}

async function getStats(organizationId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const sixteenHoursAgo = new Date(now.getTime() - 16 * 60 * 60 * 1000);

  const [todayShifts, weekShifts, staleShifts] = await Promise.all([
    // Today's shifts
    db.query.shifts.findMany({
      where: and(
        eq(shifts.organizationId, organizationId),
        gte(shifts.clockInAt, todayStart)
      ),
      columns: { durationMinutes: true, status: true, clockInAt: true },
    }),
    // This week's shifts
    db.query.shifts.findMany({
      where: and(
        eq(shifts.organizationId, organizationId),
        gte(shifts.clockInAt, weekStart),
        eq(shifts.status, "closed")
      ),
      columns: { durationMinutes: true },
    }),
    // Stale shifts
    db.query.shifts.findMany({
      where: and(
        eq(shifts.organizationId, organizationId),
        eq(shifts.status, "open"),
        lte(shifts.clockInAt, sixteenHoursAgo)
      ),
      columns: { id: true },
    }),
  ]);

  // Calculate total hours today
  let totalMinutesToday = 0;
  todayShifts.forEach((shift) => {
    if (shift.durationMinutes) {
      totalMinutesToday += shift.durationMinutes;
    } else if (shift.status === "open" && shift.clockInAt) {
      totalMinutesToday += Math.round(
        (now.getTime() - shift.clockInAt.getTime()) / 60000
      );
    }
  });

  // Calculate week hours
  const totalMinutesWeek = weekShifts.reduce(
    (sum, s) => sum + (s.durationMinutes || 0),
    0
  );

  return {
    totalHoursToday: totalMinutesToday,
    totalHoursWeek: totalMinutesWeek,
    completedToday: todayShifts.filter((s) => s.status === "closed").length,
    inProgressToday: todayShifts.filter((s) => s.status === "open").length,
    staleCount: staleShifts.length,
  };
}

export default async function TimeEntriesPage() {
  const session = await requireAuth();

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

  const [entries, stats] = await Promise.all([
    getTimeEntries(user.organizationId),
    getStats(user.organizationId),
  ]);

  return <TimeEntriesClient entries={entries} stats={stats} />;
}

import { db, eq, and, desc, gte, lte, sql } from "@timezone/database";
import { shifts, users, orgLocations, checkInRequests } from "@timezone/database/schema";
import { requireAuth } from "@/lib/auth-server";
import { ReportsClient } from "./reports-client";

async function getReportData(organizationId: string) {
  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  thisWeekStart.setHours(0, 0, 0, 0);

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Get all employees
  const employees = await db.query.users.findMany({
    where: eq(users.organizationId, organizationId),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
    },
  });

  // Get all locations
  const locations = await db.query.orgLocations.findMany({
    where: eq(orgLocations.organizationId, organizationId),
    columns: {
      id: true,
      name: true,
    },
  });

  // Get this week's shifts
  const weekShifts = await db.query.shifts.findMany({
    where: and(
      eq(shifts.organizationId, organizationId),
      gte(shifts.clockInAt, thisWeekStart),
      eq(shifts.status, "closed")
    ),
    columns: {
      userId: true,
      durationMinutes: true,
      clockInAt: true,
      locationId: true,
    },
  });

  // Get this month's shifts
  const monthShifts = await db.query.shifts.findMany({
    where: and(
      eq(shifts.organizationId, organizationId),
      gte(shifts.clockInAt, thisMonthStart),
      eq(shifts.status, "closed")
    ),
    columns: {
      userId: true,
      durationMinutes: true,
      clockInAt: true,
      locationId: true,
    },
  });

  // Get last month's shifts for comparison
  const lastMonthShifts = await db.query.shifts.findMany({
    where: and(
      eq(shifts.organizationId, organizationId),
      gte(shifts.clockInAt, lastMonthStart),
      lte(shifts.clockInAt, lastMonthEnd),
      eq(shifts.status, "closed")
    ),
    columns: {
      userId: true,
      durationMinutes: true,
    },
  });

  // Get requests this month
  const monthRequests = await db.query.checkInRequests.findMany({
    where: and(
      eq(checkInRequests.organizationId, organizationId),
      gte(checkInRequests.createdAt, thisMonthStart)
    ),
    columns: {
      userId: true,
      status: true,
      requestType: true,
    },
  });

  // Calculate employee hours (this week and month)
  const employeeHours = employees.map((emp) => {
    const weekMinutes = weekShifts
      .filter((s) => s.userId === emp.id)
      .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    const monthMinutes = monthShifts
      .filter((s) => s.userId === emp.id)
      .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    const lastMonthMinutes = lastMonthShifts
      .filter((s) => s.userId === emp.id)
      .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    const shiftsCount = monthShifts.filter((s) => s.userId === emp.id).length;

    return {
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      initials: `${emp.firstName[0]}${emp.lastName[0]}`,
      position: emp.position || "Employee",
      weekHours: Math.round(weekMinutes / 60 * 10) / 10,
      monthHours: Math.round(monthMinutes / 60 * 10) / 10,
      lastMonthHours: Math.round(lastMonthMinutes / 60 * 10) / 10,
      shiftsCount,
      avgHoursPerShift: shiftsCount > 0 ? Math.round(monthMinutes / shiftsCount / 60 * 10) / 10 : 0,
      isOvertime: weekMinutes > 40 * 60,
    };
  });

  // Calculate location stats
  const locationStats = locations.map((loc) => {
    const locShifts = monthShifts.filter((s) => s.locationId === loc.id);
    const totalMinutes = locShifts.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const uniqueEmployees = new Set(locShifts.map((s) => s.userId)).size;

    return {
      id: loc.id,
      name: loc.name,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      shiftsCount: locShifts.length,
      uniqueEmployees,
    };
  });

  // Calculate summary stats
  const totalWeekHours = weekShifts.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / 60;
  const totalMonthHours = monthShifts.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / 60;
  const totalLastMonthHours = lastMonthShifts.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / 60;

  const monthChange = totalLastMonthHours > 0
    ? Math.round((totalMonthHours - totalLastMonthHours) / totalLastMonthHours * 100)
    : 0;

  const approvedRequests = monthRequests.filter((r) => r.status === "approved").length;
  const deniedRequests = monthRequests.filter((r) => r.status === "denied").length;
  const pendingRequests = monthRequests.filter((r) => r.status === "pending").length;

  return {
    summary: {
      totalWeekHours: Math.round(totalWeekHours * 10) / 10,
      totalMonthHours: Math.round(totalMonthHours * 10) / 10,
      monthChange,
      totalShiftsMonth: monthShifts.length,
      activeEmployees: new Set(monthShifts.map((s) => s.userId)).size,
      totalEmployees: employees.length,
      overtimeEmployees: employeeHours.filter((e) => e.isOvertime).length,
      requests: {
        approved: approvedRequests,
        denied: deniedRequests,
        pending: pendingRequests,
      },
    },
    employeeHours: employeeHours.sort((a, b) => b.monthHours - a.monthHours),
    locationStats: locationStats.sort((a, b) => b.totalHours - a.totalHours),
  };
}

export default async function ReportsPage() {
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

  const reportData = await getReportData(user.organizationId);

  return <ReportsClient data={reportData} />;
}

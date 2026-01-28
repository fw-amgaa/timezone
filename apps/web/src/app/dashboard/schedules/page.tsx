import { db, eq, sql, asc } from "@timezone/database";
import {
  scheduleTemplates,
  scheduleSlots,
  scheduleAssignments,
  teams,
  users,
} from "@timezone/database/schema";
import { requireAuth } from "@/lib/auth-server";
import { SchedulesClient } from "./schedules-client";

async function getTemplates(organizationId: string) {
  const templates = await db
    .select({
      id: scheduleTemplates.id,
      name: scheduleTemplates.name,
      description: scheduleTemplates.description,
      color: scheduleTemplates.color,
      isActive: scheduleTemplates.isActive,
      createdAt: scheduleTemplates.createdAt,
    })
    .from(scheduleTemplates)
    .where(eq(scheduleTemplates.organizationId, organizationId))
    .orderBy(scheduleTemplates.name);

  // Get slots for each template
  const templateIds = templates.map((t) => t.id);
  const allSlots =
    templateIds.length > 0
      ? await db.query.scheduleSlots.findMany({
          where: (slots, { inArray }) => inArray(slots.templateId, templateIds),
        })
      : [];

  // Get assignment counts
  const assignmentCounts = await db
    .select({
      templateId: scheduleAssignments.templateId,
      count: sql<number>`count(*)`,
    })
    .from(scheduleAssignments)
    .where(eq(scheduleAssignments.isActive, true))
    .groupBy(scheduleAssignments.templateId);

  const countMap = assignmentCounts.reduce(
    (acc, { templateId, count }) => {
      acc[templateId] = Number(count);
      return acc;
    },
    {} as Record<string, number>
  );

  type SlotInfo = {
    id: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    crossesMidnight: boolean;
    breakMinutes: number;
  };

  const slotsByTemplate = allSlots.reduce(
    (acc, slot) => {
      if (!acc[slot.templateId]) acc[slot.templateId] = [];
      acc[slot.templateId].push({
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        crossesMidnight: slot.crossesMidnight,
        breakMinutes: slot.breakMinutes,
      });
      return acc;
    },
    {} as Record<string, SlotInfo[]>
  );

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    color: t.color,
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
    slots: slotsByTemplate[t.id] || [],
    assignmentCount: countMap[t.id] || 0,
  }));
}

async function getTeams(organizationId: string) {
  const orgTeams = await db.query.teams.findMany({
    where: eq(teams.organizationId, organizationId),
    columns: {
      id: true,
      name: true,
      color: true,
      isActive: true,
    },
    orderBy: [asc(teams.name)],
  });

  return orgTeams.filter((t) => t.isActive);
}

async function getEmployees(organizationId: string) {
  const employees = await db.query.users.findMany({
    where: eq(users.organizationId, organizationId),
    columns: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      position: true,
      role: true,
      isActive: true,
    },
    orderBy: [asc(users.name)],
  });

  return employees
    .filter((e) => e.isActive)
    .map((e) => ({
      ...e,
      isActive: e.isActive ?? true,
    }));
}

export default async function SchedulesPage() {
  const session = await requireAuth();

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { organizationId: true, role: true },
  });

  if (!user?.organizationId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No organization found</p>
      </div>
    );
  }

  const canEdit = ["org_admin", "org_manager", "super_admin"].includes(user.role);
  const canDelete = ["org_admin", "super_admin"].includes(user.role);

  const [templatesList, teamsList, employeesList] = await Promise.all([
    getTemplates(user.organizationId),
    getTeams(user.organizationId),
    getEmployees(user.organizationId),
  ]);

  return (
    <SchedulesClient
      templates={templatesList}
      teams={teamsList}
      employees={employeesList}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}

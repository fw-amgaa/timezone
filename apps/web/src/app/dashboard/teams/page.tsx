import { db, eq, sql, asc } from "@timezone/database";
import { teams, teamMembers, users } from "@timezone/database/schema";
import { requireAuth } from "@/lib/auth-server";
import { TeamsClient } from "./teams-client";

async function getTeams(organizationId: string) {
  const orgTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      color: teams.color,
      isActive: teams.isActive,
      createdAt: teams.createdAt,
      memberCount: sql<number>`count(${teamMembers.id})`.as("member_count"),
    })
    .from(teams)
    .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
    .where(eq(teams.organizationId, organizationId))
    .groupBy(teams.id)
    .orderBy(teams.name);

  return orgTeams.map((t) => ({
    ...t,
    memberCount: Number(t.memberCount),
    createdAt: t.createdAt.toISOString(),
  }));
}

async function getEmployees(organizationId: string) {
  const employees = await db.query.users.findMany({
    where: eq(users.organizationId, organizationId),
    columns: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      position: true,
      role: true,
      isActive: true,
    },
    orderBy: [asc(users.name)],
  });

  return employees.map((e) => ({
    ...e,
    isActive: e.isActive ?? true,
  }));
}

export default async function TeamsPage() {
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

  const [teamsList, employees] = await Promise.all([
    getTeams(user.organizationId),
    getEmployees(user.organizationId),
  ]);

  return (
    <TeamsClient
      teams={teamsList}
      employees={employees}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}

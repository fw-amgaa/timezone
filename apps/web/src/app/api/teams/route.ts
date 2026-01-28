import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and, sql } from "@timezone/database";
import { teams, teamMembers, users } from "@timezone/database/schema";
import { requireAuth } from "@/lib/auth-server";

/**
 * GET /api/teams
 * List all teams for the organization
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { user } = auth;

  if (!user.organizationId) {
    return NextResponse.json(
      { success: false, error: "No organization found" },
      { status: 400 }
    );
  }

  try {
    // Get teams with member count
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
      .where(eq(teams.organizationId, user.organizationId))
      .groupBy(teams.id)
      .orderBy(teams.name);

    return NextResponse.json({
      success: true,
      teams: orgTeams.map((t) => ({
        ...t,
        memberCount: Number(t.memberCount),
      })),
    });
  } catch (error) {
    console.error("Get teams error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teams
 * Create a new team
 */
const createTeamSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format")
    .optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { user } = auth;

  // Only org_admin and org_manager can create teams
  if (
    !user.role ||
    !["org_admin", "org_manager", "super_admin"].includes(user.role)
  ) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  if (!user.organizationId) {
    return NextResponse.json(
      { success: false, error: "No organization found" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const data = createTeamSchema.parse(body);

    // Create team
    const [newTeam] = await db
      .insert(teams)
      .values({
        organizationId: user.organizationId,
        name: data.name,
        description: data.description || null,
        color: data.color || "#6366F1",
        isActive: true,
      })
      .returning();

    // Add initial members if provided
    if (data.memberIds && data.memberIds.length > 0) {
      const memberInserts = data.memberIds.map((userId) => ({
        teamId: newTeam.id,
        userId,
        role: "member" as const,
      }));
      await db.insert(teamMembers).values(memberInserts);
    }

    return NextResponse.json({
      success: true,
      team: {
        id: newTeam.id,
        name: newTeam.name,
        description: newTeam.description,
        color: newTeam.color,
        isActive: newTeam.isActive,
        createdAt: newTeam.createdAt.toISOString(),
        memberCount: data.memberIds?.length || 0,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Create team error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

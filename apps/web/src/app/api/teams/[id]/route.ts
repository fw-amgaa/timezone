import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and, sql } from "@timezone/database";
import { teams, teamMembers, users } from "@timezone/database/schema";
import { requireAuth } from "@/lib/auth-server";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/teams/[id]
 * Get a single team with members
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { user } = auth;
  const { id } = await params;

  try {
    // Get team
    const team = await db.query.teams.findFirst({
      where: and(
        eq(teams.id, id),
        eq(teams.organizationId, user.organizationId!)
      ),
    });

    if (!team) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 }
      );
    }

    // Get team members with user details
    const members = await db
      .select({
        id: teamMembers.id,
        userId: teamMembers.userId,
        role: teamMembers.role,
        createdAt: teamMembers.createdAt,
        user: {
          id: users.id,
          name: users.name,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          phone: users.phone,
          position: users.position,
          role: users.role,
        },
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, id));

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        color: team.color,
        isActive: team.isActive,
        createdAt: team.createdAt.toISOString(),
        members: members.map((m) => ({
          membershipId: m.id,
          joinedAt: m.createdAt.toISOString(),
          ...m.user,
        })),
      },
    });
  } catch (error) {
    console.error("Get team error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/teams/[id]
 * Update a team
 */
const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format")
    .optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { user } = auth;
  const { id } = await params;

  // Only org_admin and org_manager can update teams
  if (
    !user.role ||
    !["org_admin", "org_manager", "super_admin"].includes(user.role)
  ) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const data = updateTeamSchema.parse(body);

    // Check team exists and belongs to org
    const existingTeam = await db.query.teams.findFirst({
      where: and(
        eq(teams.id, id),
        eq(teams.organizationId, user.organizationId!)
      ),
    });

    if (!existingTeam) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 }
      );
    }

    // Update team
    const [updatedTeam] = await db
      .update(teams)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      team: {
        id: updatedTeam.id,
        name: updatedTeam.name,
        description: updatedTeam.description,
        color: updatedTeam.color,
        isActive: updatedTeam.isActive,
        updatedAt: updatedTeam.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Update team error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teams/[id]
 * Delete a team
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { user } = auth;
  const { id } = await params;

  // Only org_admin can delete teams
  if (!user.role || !["org_admin", "super_admin"].includes(user.role)) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    // Check team exists and belongs to org
    const existingTeam = await db.query.teams.findFirst({
      where: and(
        eq(teams.id, id),
        eq(teams.organizationId, user.organizationId!)
      ),
    });

    if (!existingTeam) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 }
      );
    }

    // Delete team (cascade will remove team_members)
    await db.delete(teams).where(eq(teams.id, id));

    return NextResponse.json({
      success: true,
      message: "Team deleted successfully",
    });
  } catch (error) {
    console.error("Delete team error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and, inArray } from "@timezone/database";
import { teams, teamMembers, users } from "@timezone/database/schema";
import { requireAuth } from "@/lib/auth-server";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/teams/[id]/members
 * Add members to a team
 */
const addMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, "At least one user ID required"),
  role: z.enum(["lead", "member"]).optional().default("member"),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { user } = auth;
  const { id: teamId } = await params;

  // Only org_admin and org_manager can manage team members
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
    const data = addMembersSchema.parse(body);

    // Check team exists and belongs to org
    const team = await db.query.teams.findFirst({
      where: and(
        eq(teams.id, teamId),
        eq(teams.organizationId, user.organizationId!)
      ),
    });

    if (!team) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 }
      );
    }

    // Verify all users exist and belong to the same organization
    const validUsers = await db.query.users.findMany({
      where: and(
        inArray(users.id, data.userIds),
        eq(users.organizationId, user.organizationId!)
      ),
    });

    if (validUsers.length !== data.userIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Some users not found or not in organization",
        },
        { status: 400 }
      );
    }

    // Get existing memberships to avoid duplicates
    const existingMemberships = await db.query.teamMembers.findMany({
      where: and(
        eq(teamMembers.teamId, teamId),
        inArray(teamMembers.userId, data.userIds)
      ),
    });

    const existingUserIds = new Set(existingMemberships.map((m) => m.userId));
    const newUserIds = data.userIds.filter((id) => !existingUserIds.has(id));

    if (newUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All users are already members",
        addedCount: 0,
      });
    }

    // Add new members
    const memberInserts = newUserIds.map((userId) => ({
      teamId,
      userId,
      role: data.role,
    }));

    await db.insert(teamMembers).values(memberInserts);

    return NextResponse.json({
      success: true,
      message: `Added ${newUserIds.length} member(s) to team`,
      addedCount: newUserIds.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Add team members error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teams/[id]/members
 * Remove members from a team
 */
const removeMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, "At least one user ID required"),
});

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { user } = auth;
  const { id: teamId } = await params;

  // Only org_admin and org_manager can manage team members
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
    const data = removeMembersSchema.parse(body);

    // Check team exists and belongs to org
    const team = await db.query.teams.findFirst({
      where: and(
        eq(teams.id, teamId),
        eq(teams.organizationId, user.organizationId!)
      ),
    });

    if (!team) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 }
      );
    }

    // Remove members
    const result = await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          inArray(teamMembers.userId, data.userIds)
        )
      )
      .returning();

    return NextResponse.json({
      success: true,
      message: "Members removed from team",
      removedCount: result.length || 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Remove team members error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

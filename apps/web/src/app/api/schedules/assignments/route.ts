import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and, or } from "@timezone/database";
import {
  scheduleAssignments,
  scheduleTemplates,
  teams,
  users,
  teamMembers,
} from "@timezone/database/schema";
import { requireAuth } from "@/lib/auth-server";
import { sendNotification } from "@/lib/scheduler/push-sender";

/**
 * GET /api/schedules/assignments
 * List schedule assignments
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
    const templateId = request.nextUrl.searchParams.get("templateId");
    const teamId = request.nextUrl.searchParams.get("teamId");
    const userId = request.nextUrl.searchParams.get("userId");

    // Build query based on filters
    const assignments = await db.query.scheduleAssignments.findMany({
      where: and(
        // Filter by organization via template
        templateId ? eq(scheduleAssignments.templateId, templateId) : undefined,
        teamId ? eq(scheduleAssignments.teamId, teamId) : undefined,
        userId ? eq(scheduleAssignments.userId, userId) : undefined,
        eq(scheduleAssignments.isActive, true)
      ),
      with: {
        template: {
          columns: {
            id: true,
            name: true,
            color: true,
            organizationId: true,
          },
        },
        team: {
          columns: {
            id: true,
            name: true,
            color: true,
          },
        },
        user: {
          columns: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Filter by organization
    const filteredAssignments = assignments.filter(
      (a) => a.template?.organizationId === user.organizationId
    );

    return NextResponse.json({
      success: true,
      assignments: filteredAssignments.map((a) => ({
        id: a.id,
        template: a.template
          ? { id: a.template.id, name: a.template.name, color: a.template.color }
          : null,
        team: a.team
          ? { id: a.team.id, name: a.team.name, color: a.team.color }
          : null,
        user: a.user
          ? { id: a.user.id, name: a.user.name }
          : null,
        effectiveFrom: a.effectiveFrom?.toISOString() || null,
        effectiveUntil: a.effectiveUntil?.toISOString() || null,
        isActive: a.isActive,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get schedule assignments error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schedules/assignments
 * Create a new schedule assignment
 */
const createAssignmentSchema = z.object({
  templateId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().optional(),
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

  if (!["org_admin", "org_manager", "super_admin"].includes(user.role)) {
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
    const data = createAssignmentSchema.parse(body);

    // Validate: either teamId or userId must be provided, but not both
    if (!data.teamId && !data.userId) {
      return NextResponse.json(
        { success: false, error: "Either teamId or userId must be provided" },
        { status: 400 }
      );
    }

    if (data.teamId && data.userId) {
      return NextResponse.json(
        { success: false, error: "Cannot provide both teamId and userId" },
        { status: 400 }
      );
    }

    // Verify template exists and belongs to org
    const template = await db.query.scheduleTemplates.findFirst({
      where: and(
        eq(scheduleTemplates.id, data.templateId),
        eq(scheduleTemplates.organizationId, user.organizationId)
      ),
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    // Verify team/user exists and belongs to org
    if (data.teamId) {
      const team = await db.query.teams.findFirst({
        where: and(
          eq(teams.id, data.teamId),
          eq(teams.organizationId, user.organizationId)
        ),
      });
      if (!team) {
        return NextResponse.json(
          { success: false, error: "Team not found" },
          { status: 404 }
        );
      }
    }

    if (data.userId) {
      const targetUser = await db.query.users.findFirst({
        where: and(
          eq(users.id, data.userId),
          eq(users.organizationId, user.organizationId)
        ),
      });
      if (!targetUser) {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }
    }

    // Check for existing active assignment for same team/user
    const existingAssignment = await db.query.scheduleAssignments.findFirst({
      where: and(
        data.teamId
          ? eq(scheduleAssignments.teamId, data.teamId)
          : eq(scheduleAssignments.userId, data.userId!),
        eq(scheduleAssignments.isActive, true)
      ),
    });

    if (existingAssignment) {
      // Deactivate existing assignment
      await db
        .update(scheduleAssignments)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(scheduleAssignments.id, existingAssignment.id));
    }

    // Create assignment
    const [newAssignment] = await db
      .insert(scheduleAssignments)
      .values({
        templateId: data.templateId,
        teamId: data.teamId || null,
        userId: data.userId || null,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
        effectiveUntil: data.effectiveUntil
          ? new Date(data.effectiveUntil)
          : null,
        isActive: true,
        createdBy: user.id,
      })
      .returning();

    // Notify affected users about new schedule assignment
    try {
      const userIdsToNotify: string[] = [];

      if (data.userId) {
        userIdsToNotify.push(data.userId);
      } else if (data.teamId) {
        // Get all team members
        const members = await db.query.teamMembers.findMany({
          where: eq(teamMembers.teamId, data.teamId),
          columns: { userId: true },
        });
        userIdsToNotify.push(...members.map((m) => m.userId));
      }

      for (const userId of userIdsToNotify) {
        await sendNotification({
          userId,
          organizationId: user.organizationId,
          type: "schedule_update",
          title: "New Schedule Assigned",
          message: `You've been assigned to the "${template.name}" schedule. Check your working hours.`,
          data: {
            screen: "schedule" as const,
            templateId: template.id,
          },
        });
      }
    } catch (notifyError) {
      console.error("Error sending schedule assignment notifications:", notifyError);
    }

    return NextResponse.json({
      success: true,
      assignment: {
        id: newAssignment.id,
        templateId: newAssignment.templateId,
        teamId: newAssignment.teamId,
        userId: newAssignment.userId,
        effectiveFrom: newAssignment.effectiveFrom?.toISOString() || null,
        effectiveUntil: newAssignment.effectiveUntil?.toISOString() || null,
        isActive: newAssignment.isActive,
        createdAt: newAssignment.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Create schedule assignment error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/schedules/assignments
 * Delete (deactivate) an assignment
 */
const deleteAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
});

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { user } = auth;

  if (!["org_admin", "org_manager", "super_admin"].includes(user.role)) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const data = deleteAssignmentSchema.parse(body);

    // Verify assignment exists and belongs to org (via template)
    const assignment = await db.query.scheduleAssignments.findFirst({
      where: eq(scheduleAssignments.id, data.assignmentId),
      with: {
        template: {
          columns: { organizationId: true },
        },
      },
    });

    if (!assignment || assignment.template?.organizationId !== user.organizationId) {
      return NextResponse.json(
        { success: false, error: "Assignment not found" },
        { status: 404 }
      );
    }

    // Deactivate assignment
    await db
      .update(scheduleAssignments)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(scheduleAssignments.id, data.assignmentId));

    return NextResponse.json({
      success: true,
      message: "Assignment removed successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Delete schedule assignment error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

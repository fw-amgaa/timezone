import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and } from "@timezone/database";
import {
  scheduleTemplates,
  scheduleSlots,
  scheduleAssignments,
  teamMembers,
} from "@timezone/database/schema";
import { requireAuth } from "@/lib/auth-server";
import { sendNotification } from "@/lib/scheduler/push-sender";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Helper to notify all users assigned to a schedule template
 */
async function notifyScheduleUpdate(
  templateId: string,
  templateName: string,
  organizationId: string
): Promise<void> {
  // Get all active assignments for this template
  const assignments = await db.query.scheduleAssignments.findMany({
    where: and(
      eq(scheduleAssignments.templateId, templateId),
      eq(scheduleAssignments.isActive, true)
    ),
    columns: {
      userId: true,
      teamId: true,
    },
  });

  const userIdsToNotify = new Set<string>();

  for (const assignment of assignments) {
    if (assignment.userId) {
      // Direct user assignment
      userIdsToNotify.add(assignment.userId);
    } else if (assignment.teamId) {
      // Team assignment - get all team members
      const members = await db.query.teamMembers.findMany({
        where: eq(teamMembers.teamId, assignment.teamId),
        columns: { userId: true },
      });
      for (const member of members) {
        userIdsToNotify.add(member.userId);
      }
    }
  }

  // Send notification to each user
  for (const userId of userIdsToNotify) {
    await sendNotification({
      userId,
      organizationId,
      type: "schedule_update",
      title: "Schedule Updated",
      message: `Your schedule "${templateName}" has been updated. Please check your new working hours.`,
      data: {
        screen: "schedule" as const,
        templateId,
      },
    });
  }
}

/**
 * GET /api/schedules/templates/[id]
 * Get a single template with slots
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
    const template = await db.query.scheduleTemplates.findFirst({
      where: and(
        eq(scheduleTemplates.id, id),
        eq(scheduleTemplates.organizationId, user.organizationId!)
      ),
      with: {
        slots: true,
        assignments: {
          where: eq(scheduleAssignments.isActive, true),
          with: {
            team: true,
            user: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        color: template.color,
        isActive: template.isActive,
        createdAt: template.createdAt.toISOString(),
        slots: template.slots.map((s) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          crossesMidnight: s.crossesMidnight,
          breakMinutes: s.breakMinutes,
        })),
        assignments: template.assignments.map((a) => ({
          id: a.id,
          team: a.team
            ? { id: a.team.id, name: a.team.name, color: a.team.color }
            : null,
          user: a.user
            ? { id: a.user.id, name: a.user.name }
            : null,
          effectiveFrom: a.effectiveFrom?.toISOString() || null,
          effectiveUntil: a.effectiveUntil?.toISOString() || null,
        })),
      },
    });
  } catch (error) {
    console.error("Get schedule template error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/schedules/templates/[id]
 * Update a template and its slots
 */
const slotSchema = z.object({
  id: z.string().uuid().optional(), // Existing slot ID for update
  dayOfWeek: z.enum([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  crossesMidnight: z.boolean().optional().default(false),
  breakMinutes: z.number().min(0).optional().default(0),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  isActive: z.boolean().optional(),
  slots: z.array(slotSchema).min(1).optional(),
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

  if (!["org_admin", "org_manager", "super_admin"].includes(user.role)) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const data = updateTemplateSchema.parse(body);

    // Check template exists
    const existingTemplate = await db.query.scheduleTemplates.findFirst({
      where: and(
        eq(scheduleTemplates.id, id),
        eq(scheduleTemplates.organizationId, user.organizationId!)
      ),
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    // Update template
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [updatedTemplate] = await db
      .update(scheduleTemplates)
      .set(updateData)
      .where(eq(scheduleTemplates.id, id))
      .returning();

    // Update slots if provided
    let updatedSlots: typeof scheduleSlots.$inferSelect[] = [];
    if (data.slots) {
      // Delete existing slots and recreate
      await db.delete(scheduleSlots).where(eq(scheduleSlots.templateId, id));

      const slotInserts = data.slots.map((slot) => ({
        templateId: id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        crossesMidnight: slot.crossesMidnight,
        breakMinutes: slot.breakMinutes,
      }));

      updatedSlots = await db.insert(scheduleSlots).values(slotInserts).returning();
    } else {
      // Fetch existing slots
      updatedSlots = await db.query.scheduleSlots.findMany({
        where: eq(scheduleSlots.templateId, id),
      });
    }

    // If slots were updated, notify affected users
    if (data.slots) {
      try {
        await notifyScheduleUpdate(id, updatedTemplate.name, user.organizationId!);
      } catch (notifyError) {
        console.error("Error sending schedule update notifications:", notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      template: {
        id: updatedTemplate.id,
        name: updatedTemplate.name,
        description: updatedTemplate.description,
        color: updatedTemplate.color,
        isActive: updatedTemplate.isActive,
        updatedAt: updatedTemplate.updatedAt.toISOString(),
        slots: updatedSlots.map((s) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          crossesMidnight: s.crossesMidnight,
          breakMinutes: s.breakMinutes,
        })),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Update schedule template error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/schedules/templates/[id]
 * Delete a template
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

  if (!["org_admin", "super_admin"].includes(user.role)) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  try {
    const existingTemplate = await db.query.scheduleTemplates.findFirst({
      where: and(
        eq(scheduleTemplates.id, id),
        eq(scheduleTemplates.organizationId, user.organizationId!)
      ),
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    // Delete template (cascade will remove slots and assignments)
    await db.delete(scheduleTemplates).where(eq(scheduleTemplates.id, id));

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    console.error("Delete schedule template error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

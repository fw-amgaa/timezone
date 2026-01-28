import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, sql } from "@timezone/database";
import {
  scheduleTemplates,
  scheduleSlots,
  scheduleAssignments,
} from "@timezone/database/schema";
import { requireAuth } from "@/lib/auth-server";

/**
 * GET /api/schedules/templates
 * List all schedule templates for the organization
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
    const includeSlots =
      request.nextUrl.searchParams.get("includeSlots") === "true";

    // Get templates with assignment count
    const templates = await db
      .select({
        id: scheduleTemplates.id,
        name: scheduleTemplates.name,
        description: scheduleTemplates.description,
        color: scheduleTemplates.color,
        isActive: scheduleTemplates.isActive,
        createdAt: scheduleTemplates.createdAt,
        assignmentCount: sql<number>`(
          SELECT COUNT(*) FROM schedule_assignments
          WHERE template_id = ${scheduleTemplates.id} AND is_active = true
        )`.as("assignment_count"),
      })
      .from(scheduleTemplates)
      .where(eq(scheduleTemplates.organizationId, user.organizationId))
      .orderBy(scheduleTemplates.name);

    // If includeSlots, fetch slots for each template
    let templatesWithSlots = templates;
    if (includeSlots) {
      const templateIds = templates.map((t) => t.id);
      const allSlots =
        templateIds.length > 0
          ? await db.query.scheduleSlots.findMany({
              where: (slots, { inArray }) =>
                inArray(slots.templateId, templateIds),
            })
          : [];

      const slotsByTemplate = allSlots.reduce((acc, slot) => {
        if (!acc[slot.templateId]) acc[slot.templateId] = [];
        acc[slot.templateId].push(slot);
        return acc;
      }, {} as Record<string, typeof allSlots>);

      templatesWithSlots = templates.map((t) => ({
        ...t,
        slots: (slotsByTemplate[t.id] || []).map((s) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          crossesMidnight: s.crossesMidnight,
          breakMinutes: s.breakMinutes,
        })),
      }));
    }

    return NextResponse.json({
      success: true,
      templates: templatesWithSlots.map((t) => ({
        ...t,
        assignmentCount: Number(t.assignmentCount),
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get schedule templates error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schedules/templates
 * Create a new schedule template with slots
 */
const slotSchema = z.object({
  dayOfWeek: z.enum([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
  crossesMidnight: z.boolean().optional().default(false),
  breakMinutes: z.number().min(0).optional().default(0),
});

const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format")
    .optional(),
  slots: z.array(slotSchema).min(1, "At least one slot is required"),
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

  // Only org_admin and org_manager can create templates
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
    const data = createTemplateSchema.parse(body);

    // Create template
    const [newTemplate] = await db
      .insert(scheduleTemplates)
      .values({
        organizationId: user.organizationId,
        name: data.name,
        description: data.description || null,
        color: data.color || "#6366F1",
        isActive: true,
        createdBy: user.id,
      })
      .returning();

    // Create slots
    const slotInserts = data.slots.map((slot) => ({
      templateId: newTemplate.id,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      crossesMidnight: slot.crossesMidnight,
      breakMinutes: slot.breakMinutes,
    }));

    const insertedSlots = await db
      .insert(scheduleSlots)
      .values(slotInserts)
      .returning();

    return NextResponse.json({
      success: true,
      template: {
        id: newTemplate.id,
        name: newTemplate.name,
        description: newTemplate.description,
        color: newTemplate.color,
        isActive: newTemplate.isActive,
        createdAt: newTemplate.createdAt.toISOString(),
        slots: insertedSlots.map((s) => ({
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

    console.error("Create schedule template error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

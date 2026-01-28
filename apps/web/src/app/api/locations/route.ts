import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and } from "@timezone/database";
import { orgLocations, users } from "@timezone/database/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * LOCATIONS API
 *
 * Manage geofenced work locations for an organization.
 */

const locationSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  address: z.string().max(500).nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().min(50).max(5000),
  isPrimary: z.boolean().optional(),
});

// GET: List all locations for the organization
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, error: "User not found or no organization" },
        { status: 404 }
      );
    }

    const locations = await db.query.orgLocations.findMany({
      where: eq(orgLocations.organizationId, user.organizationId),
      orderBy: [orgLocations.isPrimary, orgLocations.createdAt],
    });

    return NextResponse.json({
      success: true,
      locations: locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        address: loc.address,
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        radiusMeters: loc.radiusMeters,
        isActive: loc.isActive,
        isPrimary: loc.isPrimary,
        createdAt: loc.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get locations error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create a new location
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, error: "User not found or no organization" },
        { status: 404 }
      );
    }

    // Only admins can manage locations
    if (!["org_admin", "super_admin"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = locationSchema.parse(body);

    // Verify the organization matches
    if (data.organizationId !== user.organizationId) {
      return NextResponse.json(
        { success: false, error: "Organization mismatch" },
        { status: 403 }
      );
    }

    // If setting as primary, unset any existing primary
    if (data.isPrimary) {
      await db
        .update(orgLocations)
        .set({ isPrimary: false })
        .where(eq(orgLocations.organizationId, user.organizationId));
    }

    const [newLocation] = await db
      .insert(orgLocations)
      .values({
        organizationId: data.organizationId,
        name: data.name,
        address: data.address,
        latitude: data.latitude.toString(),
        longitude: data.longitude.toString(),
        radiusMeters: data.radiusMeters,
        isPrimary: data.isPrimary ?? false,
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      location: {
        id: newLocation.id,
        name: newLocation.name,
      },
      message: "Location created successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Create location error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Update a location
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, error: "User not found or no organization" },
        { status: 404 }
      );
    }

    // Only admins can manage locations
    if (!["org_admin", "super_admin"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Location ID is required" },
        { status: 400 }
      );
    }

    // Verify location belongs to user's organization
    const existingLocation = await db.query.orgLocations.findFirst({
      where: and(
        eq(orgLocations.id, id),
        eq(orgLocations.organizationId, user.organizationId)
      ),
    });

    if (!existingLocation) {
      return NextResponse.json(
        { success: false, error: "Location not found" },
        { status: 404 }
      );
    }

    // If setting as primary, unset any existing primary
    if (data.isPrimary) {
      await db
        .update(orgLocations)
        .set({ isPrimary: false })
        .where(eq(orgLocations.organizationId, user.organizationId));
    }

    const [updatedLocation] = await db
      .update(orgLocations)
      .set({
        name: data.name,
        address: data.address,
        latitude: data.latitude?.toString(),
        longitude: data.longitude?.toString(),
        radiusMeters: data.radiusMeters,
        isPrimary: data.isPrimary,
        updatedAt: new Date(),
      })
      .where(eq(orgLocations.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      location: {
        id: updatedLocation.id,
        name: updatedLocation.name,
      },
      message: "Location updated successfully",
    });
  } catch (error) {
    console.error("Update location error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a location
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { success: false, error: "User not found or no organization" },
        { status: 404 }
      );
    }

    // Only admins can manage locations
    if (!["org_admin", "super_admin"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Location ID is required" },
        { status: 400 }
      );
    }

    // Verify location belongs to user's organization
    const existingLocation = await db.query.orgLocations.findFirst({
      where: and(
        eq(orgLocations.id, id),
        eq(orgLocations.organizationId, user.organizationId)
      ),
    });

    if (!existingLocation) {
      return NextResponse.json(
        { success: false, error: "Location not found" },
        { status: 404 }
      );
    }

    await db.delete(orgLocations).where(eq(orgLocations.id, id));

    return NextResponse.json({
      success: true,
      message: "Location deleted successfully",
    });
  } catch (error) {
    console.error("Delete location error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

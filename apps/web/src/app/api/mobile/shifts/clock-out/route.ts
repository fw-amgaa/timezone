import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and, desc } from "@timezone/database";
import { shifts, orgLocations, organizations } from "@timezone/database/schema";
import { authenticateRequest } from "@/lib/mobile-auth";
import { checkGeofence } from "@timezone/utils/geofence";

const clockOutSchema = z.object({
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().optional(),
  }),
  note: z.string().optional(),
});

/**
 * POST /api/mobile/shifts/clock-out
 *
 * Clock out from current shift.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await authenticateRequest(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: error || "Unauthorized" },
      { status: 401 }
    );
  }

  if (!user.organizationId) {
    return NextResponse.json(
      { success: false, error: "User not associated with an organization" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const validation = clockOutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request data" },
        { status: 400 }
      );
    }

    const { location } = validation.data;

    // Find open shift
    const openShift = await db.query.shifts.findFirst({
      where: and(eq(shifts.userId, user.id), eq(shifts.status, "open")),
      orderBy: [desc(shifts.clockInAt)],
    });

    if (!openShift) {
      return NextResponse.json(
        { success: false, error: "No open shift found" },
        { status: 400 }
      );
    }

    // Get organization and locations for geofence check
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, user.organizationId),
    });

    if (!org) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get all active locations
    const locations = await db.query.orgLocations.findMany({
      where: eq(orgLocations.organizationId, user.organizationId),
    });

    const activeLocations = locations.filter((loc) => loc.isActive);

    // Build geofences to check
    type Geofence = {
      id: string;
      center: { latitude: number; longitude: number };
      radiusMeters: number;
    };
    const geofences: Geofence[] = activeLocations.map((loc) => ({
      id: loc.id,
      center: {
        latitude: parseFloat(loc.latitude),
        longitude: parseFloat(loc.longitude),
      },
      radiusMeters: loc.radiusMeters || 200,
    }));

    // Add org primary location if no specific locations
    if (geofences.length === 0 && org.latitude && org.longitude) {
      geofences.push({
        id: "org-primary",
        center: {
          latitude: parseFloat(org.latitude),
          longitude: parseFloat(org.longitude),
        },
        radiusMeters: org.geofenceSettings?.radiusMeters || 200,
      });
    }

    // Check if user is within any geofence
    let isInRange = false;

    for (const geofence of geofences) {
      const result = checkGeofence(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy || 50,
        },
        geofence
      );

      if (result.isWithinRange) {
        isInRange = true;
        break;
      }
    }

    const locationStatus = isInRange ? "in_range" : "out_of_range";

    // For clock-out, we're less strict - we'll allow it but mark status
    // Strict mode only blocks clock-in, not clock-out
    const now = new Date();
    const durationMinutes = Math.floor(
      (now.getTime() - openShift.clockInAt.getTime()) / 60000
    );

    // Update the shift
    const [updatedShift] = await db
      .update(shifts)
      .set({
        status: "closed",
        clockOutAt: now,
        clockOutLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy || 50,
          timestamp: now.toISOString(),
        },
        clockOutLocationStatus: locationStatus,
        durationMinutes,
        updatedAt: now,
      })
      .where(eq(shifts.id, openShift.id))
      .returning();

    return NextResponse.json({
      success: true,
      shift: {
        id: updatedShift.id,
        status: updatedShift.status,
        clockInAt: updatedShift.clockInAt.toISOString(),
        clockOutAt: updatedShift.clockOutAt?.toISOString(),
        durationMinutes: updatedShift.durationMinutes,
        locationStatus,
      },
    });
  } catch (error) {
    console.error("Clock out error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

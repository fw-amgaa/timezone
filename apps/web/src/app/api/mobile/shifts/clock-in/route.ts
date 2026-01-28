import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and, desc } from "@timezone/database";
import { shifts, orgLocations, organizations } from "@timezone/database/schema";
import { authenticateRequest } from "@/lib/mobile-auth";
import { checkGeofence } from "@timezone/utils/geofence";

const clockInSchema = z.object({
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().optional(),
  }),
  note: z.string().optional(),
});

/**
 * POST /api/mobile/shifts/clock-in
 *
 * Clock in for a shift. Only allowed if user is within geofence.
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
    const validation = clockInSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request data" },
        { status: 400 }
      );
    }

    const { location } = validation.data;

    // Check for existing open shift
    const existingShift = await db.query.shifts.findFirst({
      where: and(eq(shifts.userId, user.id), eq(shifts.status, "open")),
      orderBy: [desc(shifts.clockInAt)],
    });

    if (existingShift) {
      return NextResponse.json(
        {
          success: false,
          error: "You already have an open shift. Please clock out first.",
        },
        { status: 400 }
      );
    }

    // Get organization and locations
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
    let matchedLocationId: string | null = null;

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
        matchedLocationId = geofence.id;
        break;
      }
    }

    // Determine location status
    const locationStatus = isInRange ? "in_range" : "out_of_range";

    if (!isInRange && org.geofenceSettings?.strictMode) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You are outside all work locations. Please submit a check-in request instead.",
          requiresRequest: true,
        },
        { status: 400 }
      );
    }

    // Create the shift
    const now = new Date();
    const [newShift] = await db
      .insert(shifts)
      .values({
        organizationId: user.organizationId,
        userId: user.id,
        locationId:
          matchedLocationId && matchedLocationId !== "org-primary"
            ? matchedLocationId
            : null,
        status: "open",
        clockInAt: now,
        clockInLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy || 50,
          timestamp: now.toISOString(),
        },
        clockInLocationStatus: locationStatus,
        shiftDate: now,
        breakMinutes: 0,
        isRevised: false,
        wasOffline: false,
      })
      .returning();

    return NextResponse.json({
      success: true,
      shift: {
        id: newShift.id,
        status: newShift.status,
        clockInAt: newShift.clockInAt.toISOString(),
        locationStatus,
      },
    });
  } catch (error) {
    console.error("Clock in error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db, eq } from "@timezone/database";
import { orgLocations, organizations } from "@timezone/database/schema";
import { authenticateRequest } from "@/lib/mobile-auth";

/**
 * GET /api/mobile/locations
 *
 * Get all active locations for the authenticated user's organization.
 * Used for geofencing on the mobile app.
 */
export async function GET(request: NextRequest) {
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
    // Get organization details for primary location and geofence settings
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, user.organizationId),
    });

    if (!org) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get all active locations for the organization
    const locations = await db.query.orgLocations.findMany({
      where: eq(orgLocations.organizationId, user.organizationId),
    });

    // Filter to only active locations
    const activeLocations = locations.filter((loc) => loc.isActive);

    // Format locations for mobile
    const formattedLocations = activeLocations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      latitude: parseFloat(loc.latitude),
      longitude: parseFloat(loc.longitude),
      radiusMeters: loc.radiusMeters || 200,
      isPrimary: loc.isPrimary,
    }));

    // If no specific locations but org has coordinates, use org primary location
    if (formattedLocations.length === 0 && org.latitude && org.longitude) {
      formattedLocations.push({
        id: "org-primary",
        name: org.name,
        address: org.address || null,
        latitude: parseFloat(org.latitude),
        longitude: parseFloat(org.longitude),
        radiusMeters: org.geofenceSettings?.radiusMeters || 200,
        isPrimary: true,
      });
    }

    return NextResponse.json({
      success: true,
      locations: formattedLocations,
      geofenceSettings: org.geofenceSettings,
      organization: {
        id: org.id,
        name: org.name,
      },
    });
  } catch (error) {
    console.error("Get locations error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

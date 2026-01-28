import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverVerifyLocation, type LocationWithAccuracy } from "@timezone/utils/geofence";

// Request validation schema
const clockInSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().min(0),
    timestamp: z.number().optional(),
    altitude: z.number().optional(),
    speed: z.number().optional(),
    heading: z.number().optional(),
  }),
  deviceInfo: z.object({
    platform: z.string(),
    appVersion: z.string(),
    deviceId: z.string(),
  }),
  note: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = clockInSchema.parse(body);

    // TODO: Get organization's geofence settings from database
    const orgGeofence = {
      center: { latitude: 40.7128, longitude: -74.006 },
      radiusMeters: 200,
    };

    // Server-side location verification (anti-spoofing)
    const verificationResult = serverVerifyLocation(
      data.location as LocationWithAccuracy,
      orgGeofence,
      {
        maxAcceptableAccuracy: 100,
        requireRecentTimestamp: true,
        maxTimestampAge: 60000,
      }
    );

    // If location verification failed, return early
    if (!verificationResult.verified) {
      return NextResponse.json(
        {
          success: false,
          error: "location_verification_failed",
          message: verificationResult.rejectionReason || "Could not verify your location",
          requiresRequest: true,
          distance: verificationResult.result.distanceMeters,
        },
        { status: 400 }
      );
    }

    // TODO: Check for existing open shift (prevent double clock-in)
    // This would be a database transaction:
    // 1. Check for open shifts for this user
    // 2. If found, return error
    // 3. If not, create new shift with status "open"

    const now = new Date();
    const shiftDate = new Date(now);
    shiftDate.setHours(0, 0, 0, 0); // Start of day for attribution

    // Mock shift creation
    const shift = {
      id: crypto.randomUUID(),
      userId: data.userId,
      organizationId: data.organizationId,
      status: "open",
      clockInAt: now.toISOString(),
      clockInLocation: data.location,
      clockInLocationStatus: verificationResult.result.status,
      clockInServerVerification: {
        verified: true,
        distanceFromTarget: verificationResult.result.distanceMeters,
        targetLocationId: "default",
        verifiedAt: now.toISOString(),
        flags: verificationResult.flags,
      },
      clockInDeviceInfo: data.deviceInfo,
      clockInNote: data.note,
      shiftDate: shiftDate.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // TODO: Insert into database and create audit log

    return NextResponse.json({
      success: true,
      shift,
      message: "Successfully clocked in",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "validation_error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Clock-in error:", error);
    return NextResponse.json(
      { success: false, error: "internal_error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

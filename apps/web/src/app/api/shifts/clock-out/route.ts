import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverVerifyLocation, type LocationWithAccuracy } from "@timezone/utils/geofence";
import { calculateShiftDuration, calculateAutoBreak } from "@timezone/utils/shifts";

// Request validation schema
const clockOutSchema = z.object({
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

/**
 * SHIFT LINKAGE ALGORITHM
 *
 * When clocking out, we need to:
 * 1. Find the most recent OPEN shift for this user
 * 2. Verify location (server-side anti-spoofing)
 * 3. Calculate duration (handles midnight crossing)
 * 4. Apply automatic break deductions if applicable
 * 5. Update shift status to "closed"
 * 6. Create audit log
 *
 * This is wrapped in a database transaction to prevent:
 * - Double clock-outs
 * - Race conditions
 * - Data inconsistency
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = clockOutSchema.parse(body);

    // TODO: Start database transaction

    // STEP 1: Find the most recent OPEN shift for this user
    // This is the "Shift Linkage" - we link the clock-out to the open shift
    // SQL: SELECT * FROM shifts WHERE user_id = ? AND status = 'open' ORDER BY clock_in_at DESC LIMIT 1

    // Mock: Simulate finding an open shift (8 PM yesterday)
    const mockClockInTime = new Date();
    mockClockInTime.setDate(mockClockInTime.getDate() - 1); // Yesterday
    mockClockInTime.setHours(20, 0, 0, 0); // 8 PM

    const openShift = {
      id: "mock-shift-id",
      userId: data.userId,
      organizationId: data.organizationId,
      status: "open",
      clockInAt: mockClockInTime.toISOString(),
      shiftDate: new Date(mockClockInTime.setHours(0, 0, 0, 0)).toISOString(),
    };

    if (!openShift) {
      return NextResponse.json(
        {
          success: false,
          error: "no_open_shift",
          message: "No active shift found. Please clock in first.",
        },
        { status: 400 }
      );
    }

    // STEP 2: Server-side location verification
    const orgGeofence = {
      center: { latitude: 40.7128, longitude: -74.006 },
      radiusMeters: 200,
    };

    const verificationResult = serverVerifyLocation(
      data.location as LocationWithAccuracy,
      orgGeofence,
      {
        maxAcceptableAccuracy: 100,
        requireRecentTimestamp: true,
        maxTimestampAge: 60000,
      }
    );

    // For clock-out, we may be more lenient (allow out-of-range with note)
    const locationStatus = verificationResult.verified ? "in_range" : "out_of_range";

    // STEP 3: Calculate shift duration using our utility
    const clockOutTime = new Date();
    const durationResult = calculateShiftDuration(
      openShift.clockInAt,
      clockOutTime.toISOString()
    );

    // STEP 4: Apply automatic break deduction if applicable
    // Default: 30min break auto-deducted for shifts >= 6 hours
    const autoBreakMinutes = calculateAutoBreak(
      durationResult.totalMinutes,
      6, // threshold hours
      30 // break minutes
    );

    const netDurationMinutes = durationResult.totalMinutes - autoBreakMinutes;

    // STEP 5: Prepare the updated shift record
    const closedShift = {
      ...openShift,
      status: "closed",
      clockOutAt: clockOutTime.toISOString(),
      clockOutLocation: data.location,
      clockOutLocationStatus: locationStatus,
      clockOutServerVerification: {
        verified: verificationResult.verified,
        distanceFromTarget: verificationResult.result.distanceMeters,
        targetLocationId: "default",
        verifiedAt: clockOutTime.toISOString(),
        flags: verificationResult.flags,
      },
      clockOutDeviceInfo: data.deviceInfo,
      clockOutNote: data.note,
      durationMinutes: durationResult.totalMinutes,
      breakMinutes: autoBreakMinutes,
      netDurationMinutes: netDurationMinutes,
      updatedAt: clockOutTime.toISOString(),
    };

    // TODO: Update shift in database within transaction
    // TODO: Create audit log entry
    // TODO: Commit transaction

    return NextResponse.json({
      success: true,
      shift: closedShift,
      duration: {
        total: durationResult.formatted,
        totalMinutes: durationResult.totalMinutes,
        netMinutes: netDurationMinutes,
        breakMinutes: autoBreakMinutes,
        crossedMidnight: durationResult.crossedMidnight,
        attributedDate: durationResult.attributedDate.toISOString(),
      },
      message: `Successfully clocked out. Shift duration: ${durationResult.formatted}`,
    });
  } catch (error) {
    // TODO: Rollback transaction on error

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "validation_error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Clock-out error:", error);
    return NextResponse.json(
      { success: false, error: "internal_error", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

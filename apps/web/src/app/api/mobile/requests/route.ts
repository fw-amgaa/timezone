import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and, desc } from "@timezone/database";
import { checkInRequests, shifts } from "@timezone/database/schema";
import { authenticateRequest } from "@/lib/mobile-auth";

/**
 * POST /api/mobile/requests
 *
 * Create a new check-in request for out-of-range clock-in/clock-out.
 * Automatically determines if this is a clock-in or clock-out based on current shift status.
 */

const createRequestSchema = z.object({
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().min(0),
    timestamp: z.string(),
  }),
  reason: z.string().min(10, "Please provide a detailed reason"),
  // Optional fields for historical requests
  requestType: z.enum(["clock_in", "clock_out"]).optional(),
  isHistorical: z.boolean().optional(),
  requestedTime: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const { user, error } = await authenticateRequest(request);

  console.log("here");

  if (!user) {
    return NextResponse.json(
      { success: false, error: error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const data = createRequestSchema.parse(body);

    // Determine request type based on:
    // 1. Explicit requestType from historical requests
    // 2. Current shift status (for current requests)
    let requestType: "clock_in" | "clock_out";
    let openShift = null;

    if (data.isHistorical && data.requestType) {
      // Historical request - use explicit request type
      requestType = data.requestType;
    } else {
      // Current request - determine based on shift status
      openShift = await db.query.shifts.findFirst({
        where: and(eq(shifts.userId, user.id), eq(shifts.status, "open")),
        orderBy: [desc(shifts.clockInAt)],
      });
      requestType = openShift ? "clock_out" : "clock_in";
    }

    // Create request expiration (24 hours from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // For historical requests, use the provided timestamp
    const requestedTimestamp = data.isHistorical && data.requestedTime
      ? new Date(data.requestedTime)
      : now;

    // Validate historical timestamp is in the past and within 30 days
    if (data.isHistorical && data.requestedTime) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (requestedTimestamp > now) {
        return NextResponse.json(
          { success: false, error: "Historical requests must be for past dates" },
          { status: 400 }
        );
      }

      if (requestedTimestamp < thirtyDaysAgo) {
        return NextResponse.json(
          { success: false, error: "Historical requests cannot be more than 30 days in the past" },
          { status: 400 }
        );
      }
    }

    // Build reason with historical context if applicable
    const reasonWithContext = data.isHistorical
      ? `[HISTORICAL REQUEST for ${requestedTimestamp.toLocaleString()}] ${data.reason}`
      : data.reason;

    // Insert the request
    const [newRequest] = await db
      .insert(checkInRequests)
      .values({
        organizationId: user.organizationId!,
        userId: user.id,
        shiftId: openShift?.id || null,
        requestType,
        status: "pending",
        requestedLocation: {
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          accuracy: data.location.accuracy,
          timestamp: data.location.timestamp,
        },
        reason: reasonWithContext,
        requestedTimestamp,
        expiresAt,
      })
      .returning();

    const requestLabel = data.isHistorical ? "historical " : "";
    const typeLabel = requestType === "clock_in" ? "clock-in" : "clock-out";

    return NextResponse.json({
      success: true,
      request: {
        id: newRequest.id,
        requestType,
        status: newRequest.status,
        isHistorical: !!data.isHistorical,
        requestedTimestamp: requestedTimestamp.toISOString(),
        createdAt: newRequest.createdAt.toISOString(),
      },
      requestType,
      message: `Your ${requestLabel}${typeLabel} request has been submitted and is pending manager approval`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Create request error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mobile/requests
 *
 * Get the current user's requests (for employee view).
 */
export async function GET(request: NextRequest) {
  const { user, error } = await authenticateRequest(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const status = request.nextUrl.searchParams.get("status");

    const whereConditions = [eq(checkInRequests.userId, user.id)];

    if (status) {
      whereConditions.push(eq(checkInRequests.status, status as any));
    }

    const requests = await db.query.checkInRequests.findMany({
      where: and(...whereConditions),
      orderBy: [desc(checkInRequests.createdAt)],
      limit: 50,
    });

    return NextResponse.json({
      success: true,
      requests: requests.map((r) => ({
        id: r.id,
        requestType: r.requestType,
        status: r.status,
        reason: r.reason,
        requestedLocation: r.requestedLocation,
        requestedTimestamp: r.requestedTimestamp.toISOString(),
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString(),
        reviewerNote: r.reviewerNote,
        denialReason: r.denialReason,
      })),
    });
  } catch (error) {
    console.error("Get requests error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

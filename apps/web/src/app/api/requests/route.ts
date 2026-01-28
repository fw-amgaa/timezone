import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and, desc, or, sql } from "@timezone/database";
import { checkInRequests, shifts, users } from "@timezone/database/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { sendNotification } from "@/lib/scheduler/push-sender";

/**
 * CHECK-IN REQUEST API (Web Dashboard)
 *
 * Handles out-of-range clock-in/clock-out requests for managers.
 */

// GET: List requests for the organization
export async function GET(request: NextRequest) {
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

    // Check if user is manager or admin
    if (!["org_admin", "org_manager", "super_admin"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Not authorized to view requests" },
        { status: 403 }
      );
    }

    const status = request.nextUrl.searchParams.get("status");

    // Build query conditions
    const whereConditions = [eq(checkInRequests.organizationId, user.organizationId)];

    if (status === "pending") {
      whereConditions.push(eq(checkInRequests.status, "pending"));
    } else if (status === "resolved") {
      whereConditions.push(
        or(
          eq(checkInRequests.status, "approved"),
          eq(checkInRequests.status, "denied")
        )!
      );
    }

    const requests = await db.query.checkInRequests.findMany({
      where: and(...whereConditions),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
          },
        },
        reviewer: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [desc(checkInRequests.createdAt)],
      limit: 100,
    });

    return NextResponse.json({
      success: true,
      requests: requests.map((r) => ({
        id: r.id,
        user: {
          id: r.user.id,
          name: `${r.user.firstName} ${r.user.lastName}`,
          initials: `${r.user.firstName[0]}${r.user.lastName[0]}`,
          position: r.user.position || "Employee",
          email: r.user.email,
        },
        type: r.requestType,
        reason: r.reason,
        distance: r.distanceFromGeofence || 0,
        location: r.requestedLocation,
        status: r.status,
        requestedTime: r.requestedTimestamp.toISOString(),
        submittedAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt?.toISOString(),
        resolvedBy: r.reviewer
          ? `${r.reviewer.firstName} ${r.reviewer.lastName}`
          : null,
        resolvedAt: r.reviewedAt?.toISOString(),
        reviewerNote: r.reviewerNote,
        denialReason: r.denialReason,
      })),
      total: requests.length,
    });
  } catch (error) {
    console.error("Get requests error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Review schema for PATCH
const reviewSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["approve", "deny"]),
  note: z.string().optional(),
  denialReason: z.string().optional(),
});

// PATCH: Review (approve/deny) a request
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

    const reviewer = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!reviewer || !reviewer.organizationId) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user is manager or admin
    if (!["org_admin", "org_manager", "super_admin"].includes(reviewer.role)) {
      return NextResponse.json(
        { success: false, error: "Not authorized to review requests" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = reviewSchema.parse(body);

    // Validate denial requires reason
    if (data.action === "deny" && !data.denialReason) {
      return NextResponse.json(
        { success: false, error: "Denial reason is required when denying a request" },
        { status: 400 }
      );
    }

    // Get the request
    const checkInRequest = await db.query.checkInRequests.findFirst({
      where: and(
        eq(checkInRequests.id, data.requestId),
        eq(checkInRequests.organizationId, reviewer.organizationId)
      ),
      with: {
        user: true,
      },
    });

    if (!checkInRequest) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );
    }

    if (checkInRequest.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Request has already been reviewed" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Update the request
    const [updatedRequest] = await db
      .update(checkInRequests)
      .set({
        status: data.action === "approve" ? "approved" : "denied",
        reviewedBy: reviewer.id,
        reviewedAt: now,
        reviewerNote: data.note,
        denialReason: data.denialReason,
        updatedAt: now,
      })
      .where(eq(checkInRequests.id, data.requestId))
      .returning();

    // If approved, create the actual shift or clock out
    if (data.action === "approve") {
      if (checkInRequest.requestType === "clock_in") {
        // Create a new shift
        await db.insert(shifts).values({
          organizationId: checkInRequest.organizationId,
          userId: checkInRequest.userId,
          status: "open",
          clockInAt: checkInRequest.requestedTimestamp,
          clockInLocation: checkInRequest.requestedLocation,
          clockInLocationStatus: "out_of_range",
          shiftDate: checkInRequest.requestedTimestamp,
          clockInNote: `Approved out-of-range clock-in: ${checkInRequest.reason}`,
        });
      } else if (checkInRequest.requestType === "clock_out" && checkInRequest.shiftId) {
        // Close the existing shift
        const clockInAt = await db.query.shifts.findFirst({
          where: eq(shifts.id, checkInRequest.shiftId),
          columns: { clockInAt: true },
        });

        const durationMinutes = clockInAt
          ? Math.round(
              (checkInRequest.requestedTimestamp.getTime() -
                clockInAt.clockInAt.getTime()) /
                60000
            )
          : null;

        await db
          .update(shifts)
          .set({
            status: "closed",
            clockOutAt: checkInRequest.requestedTimestamp,
            clockOutLocation: checkInRequest.requestedLocation,
            clockOutLocationStatus: "out_of_range",
            durationMinutes,
            clockOutNote: `Approved out-of-range clock-out: ${checkInRequest.reason}`,
            updatedAt: now,
          })
          .where(eq(shifts.id, checkInRequest.shiftId));
      }
    }

    // Send notification to the user who submitted the request
    const reviewerName = [reviewer.firstName, reviewer.lastName]
      .filter(Boolean)
      .join(" ") || "A manager";

    const requestTypeLabel =
      checkInRequest.requestType === "clock_in" ? "clock-in" : "clock-out";

    try {
      if (data.action === "approve") {
        await sendNotification({
          userId: checkInRequest.userId,
          organizationId: checkInRequest.organizationId,
          type: "request_approved",
          title: "Request Approved",
          message: `Your ${requestTypeLabel} request has been approved by ${reviewerName}.${data.note ? ` Note: ${data.note}` : ""}`,
          data: {
            screen: "history" as const,
            requestId: checkInRequest.id,
          },
        });
      } else {
        await sendNotification({
          userId: checkInRequest.userId,
          organizationId: checkInRequest.organizationId,
          type: "request_denied",
          title: "Request Denied",
          message: `Your ${requestTypeLabel} request has been denied by ${reviewerName}. Reason: ${data.denialReason}`,
          data: {
            screen: "history" as const,
            requestId: checkInRequest.id,
          },
        });
      }
    } catch (notifyError) {
      // Log but don't fail the request if notification fails
      console.error("Error sending request review notification:", notifyError);
    }

    return NextResponse.json({
      success: true,
      request: {
        id: updatedRequest.id,
        status: updatedRequest.status,
        reviewedAt: updatedRequest.reviewedAt?.toISOString(),
      },
      message: `Request has been ${data.action === "approve" ? "approved" : "denied"}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Review request error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

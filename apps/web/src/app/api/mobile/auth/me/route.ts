import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, sanitizeUser } from "@/lib/mobile-auth";

/**
 * GET /api/mobile/auth/me
 *
 * Get the current authenticated user's profile.
 * Used to validate session and restore user data on app launch.
 */

export async function GET(request: NextRequest) {
  const { user, error } = await authenticateRequest(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: error || "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    user: sanitizeUser(user),
  });
}

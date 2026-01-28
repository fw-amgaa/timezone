import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq } from "@timezone/database";
import { users } from "@timezone/database/schema";

/**
 * POST /api/mobile/auth/check-phone
 *
 * Check if a phone number exists and whether the user has a password set.
 * Used to determine the authentication flow (login vs first-time registration).
 */

const schema = z.object({
  phone: z.string().min(8, "Phone number is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = schema.parse(body);

    // Clean phone number (remove non-digits)
    const cleanPhone = phone.replace(/\D/g, "");

    const user = await db.query.users.findFirst({
      where: eq(users.phone, cleanPhone),
    });

    if (!user) {
      return NextResponse.json({
        success: true,
        exists: false,
        hasPassword: false,
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "Account is deactivated. Please contact your administrator.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      exists: true,
      hasPassword: !!user.passwordHash,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number" },
        { status: 400 }
      );
    }

    console.error("Check phone error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

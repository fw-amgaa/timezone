import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and, gt, desc } from "@timezone/database";
import { otpVerifications } from "@timezone/database/schema";
import { createVerificationToken } from "@/lib/mobile-auth";

/**
 * POST /api/mobile/auth/verify-otp
 *
 * Verify an OTP code. Returns a verification token on success
 * that can be used to set a password or reset password.
 * Max 3 attempts per OTP.
 */

const schema = z.object({
  phone: z.string().min(8, "Phone number is required"),
  code: z.string().length(6, "Code must be 6 digits"),
});

const MAX_ATTEMPTS = 3;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code } = schema.parse(body);

    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, "");

    // Find the most recent pending OTP for this phone
    const otp = await db.query.otpVerifications.findFirst({
      where: and(
        eq(otpVerifications.phone, cleanPhone),
        eq(otpVerifications.status, "pending"),
        gt(otpVerifications.expiresAt, new Date())
      ),
      orderBy: [desc(otpVerifications.createdAt)],
    });

    if (!otp) {
      return NextResponse.json(
        {
          success: false,
          error: "No valid verification code found. Please request a new code.",
        },
        { status: 400 }
      );
    }

    const attempts = parseInt(otp.attempts || "0");

    // Check if max attempts exceeded
    if (attempts >= MAX_ATTEMPTS) {
      await db
        .update(otpVerifications)
        .set({ status: "max_attempts" })
        .where(eq(otpVerifications.id, otp.id));

      return NextResponse.json(
        {
          success: false,
          error: "Maximum attempts exceeded. Please request a new code.",
        },
        { status: 400 }
      );
    }

    // Verify the code
    if (otp.code !== code) {
      // Increment attempts
      await db
        .update(otpVerifications)
        .set({ attempts: (attempts + 1).toString() })
        .where(eq(otpVerifications.id, otp.id));

      const remainingAttempts = MAX_ATTEMPTS - attempts - 1;

      return NextResponse.json(
        {
          success: false,
          error: `Invalid code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining.`,
          remainingAttempts,
        },
        { status: 400 }
      );
    }

    // Mark OTP as verified
    await db
      .update(otpVerifications)
      .set({
        status: "verified",
        verifiedAt: new Date(),
      })
      .where(eq(otpVerifications.id, otp.id));

    // Create a short-lived verification token for password setup
    const verificationToken = createVerificationToken(cleanPhone);

    return NextResponse.json({
      success: true,
      message: "Phone number verified successfully",
      verificationToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input" },
        { status: 400 }
      );
    }

    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

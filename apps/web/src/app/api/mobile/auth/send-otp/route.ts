import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, eq, and, gt } from "@timezone/database";
import { users, otpVerifications } from "@timezone/database/schema";
import { sendOTPSMS, generateOTPCode } from "@/lib/sms";

/**
 * POST /api/mobile/auth/send-otp
 *
 * Generate and send an OTP code to the user's phone number.
 * Rate limited to 1 request per minute per phone number.
 */

const schema = z.object({
  phone: z.string().min(8, "Phone number is required"),
});

// OTP validity in minutes
const OTP_VALIDITY_MINUTES = 5;
// Rate limit: minimum seconds between OTP requests
const RATE_LIMIT_SECONDS = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = schema.parse(body);

    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, "");

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(users.phone, cleanPhone),
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "No account found with this phone number" },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Account is deactivated" },
        { status: 403 }
      );
    }

    // Rate limiting: check for recent OTP
    const rateLimitTime = new Date(Date.now() - RATE_LIMIT_SECONDS * 1000);
    const recentOtp = await db.query.otpVerifications.findFirst({
      where: and(
        eq(otpVerifications.phone, cleanPhone),
        gt(otpVerifications.createdAt, rateLimitTime)
      ),
    });

    if (recentOtp) {
      const waitSeconds = Math.ceil(
        (new Date(recentOtp.createdAt).getTime() +
          RATE_LIMIT_SECONDS * 1000 -
          Date.now()) /
          1000
      );
      return NextResponse.json(
        {
          success: false,
          error: `Please wait ${waitSeconds} seconds before requesting another code`,
          retryAfter: waitSeconds,
        },
        { status: 429 }
      );
    }

    // Generate OTP code
    const code = generateOTPCode();
    const expiresAt = new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000);

    // Invalidate any existing pending OTPs for this phone
    await db
      .update(otpVerifications)
      .set({ status: "expired" })
      .where(
        and(
          eq(otpVerifications.phone, cleanPhone),
          eq(otpVerifications.status, "pending")
        )
      );

    // Store new OTP
    await db.insert(otpVerifications).values({
      phone: cleanPhone,
      code,
      status: "pending",
      attempts: "0",
      expiresAt,
    });

    // Send OTP via SMS
    const smsResult = await sendOTPSMS(cleanPhone, code);

    if (!smsResult.success) {
      console.error("Failed to send OTP SMS:", smsResult.error);
      // Still return success to not reveal if SMS actually sent (security)
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent",
      expiresIn: OTP_VALIDITY_MINUTES * 60, // seconds
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number" },
        { status: 400 }
      );
    }

    console.error("Send OTP error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

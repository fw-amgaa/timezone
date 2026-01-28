/**
 * SMS Service - Skytel Integration
 *
 * Sends SMS messages via Skytel's web2sms API for Mongolia.
 */

const SMS_URL = process.env.SMS_URL;
const SMS_TOKEN = process.env.SMS_TOKEN;

interface SendSMSParams {
  phone: string;
  message: string;
}

interface SMSResponse {
  success: boolean;
  error?: string;
}

/**
 * Send an SMS message via Skytel
 */
export async function sendSMS({
  phone,
  message,
}: SendSMSParams): Promise<SMSResponse> {
  if (!SMS_URL || !SMS_TOKEN) {
    console.error("SMS configuration missing: SMS_URL or SMS_TOKEN not set");
    // In development, just log the message
    console.log(`[SMS] To: ${phone}, Message: ${message}`);
    return { success: true };
  }

  try {
    // Build the URL with parameters
    const url = SMS_URL.replace("{phone}", encodeURIComponent(phone)).replace(
      "{message}",
      encodeURIComponent(message)
    );

    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("SMS send failed:", text);
      return { success: false, error: `SMS send failed: ${response.status}` };
    }

    console.log(`[SMS] Sent to ${phone}: ${message}`);
    return { success: true };
  } catch (error) {
    console.error("SMS send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send an OTP verification code
 */
export async function sendOTPSMS(
  phone: string,
  code: string
): Promise<SMSResponse> {
  const message = `Your TimeZone verification code is: ${code}. Valid for 5 minutes. Do not share this code.`;
  return sendSMS({ phone, message });
}

/**
 * Generate a 6-digit OTP code
 */
export function generateOTPCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

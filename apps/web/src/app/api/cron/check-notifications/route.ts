import { NextRequest, NextResponse } from "next/server";
import { runNotificationChecks } from "@/lib/scheduler";

/**
 * GET /api/cron/check-notifications
 *
 * Runs all notification checks (clock-in and clock-out reminders).
 * Should be called every minute by an external scheduler.
 *
 * Security: Uses a shared secret via CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startTime = Date.now();
    const results = await runNotificationChecks();
    const duration = Date.now() - startTime;

    console.log(
      `[Cron] Notification check completed in ${duration}ms:`,
      `Clock-in: ${results.clockIn.sent} sent, ${results.clockIn.skipped} skipped`,
      `Clock-out: ${results.clockOut.sent} sent, ${results.clockOut.skipped} skipped`,
      `Errors: ${results.totalErrors}`
    );

    return NextResponse.json({
      success: true,
      duration,
      results,
    });
  } catch (error) {
    console.error("[Cron] Error running notification checks:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/check-notifications
 *
 * Alternative method for triggering via POST request
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

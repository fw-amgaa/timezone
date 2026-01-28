import { NextRequest, NextResponse } from "next/server";
import { sendWeeklySummaries } from "@/lib/scheduler";

/**
 * GET /api/cron/weekly-summary
 *
 * Sends weekly summary notifications to all employees.
 * Should be called once per week (e.g., Sunday evening at 6 PM).
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
    const results = await sendWeeklySummaries();
    const duration = Date.now() - startTime;

    console.log(
      `[Cron] Weekly summaries completed in ${duration}ms:`,
      `Organizations: ${results.organizations}`,
      `Sent: ${results.sent}`,
      `Errors: ${results.errors}`
    );

    return NextResponse.json({
      success: true,
      duration,
      results,
    });
  } catch (error) {
    console.error("[Cron] Error sending weekly summaries:", error);
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
 * POST /api/cron/weekly-summary
 *
 * Alternative method for triggering via POST request
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

import { Sidebar } from "@/components/dashboard/sidebar";
import { requireAuth } from "@/lib/auth-server";
import { db, eq, and } from "@timezone/database";
import { checkInRequests, shifts, users } from "@timezone/database/schema";

async function getBadgeCounts(organizationId: string) {
  const [pendingRequests, staleShifts] = await Promise.all([
    // Count pending requests for this organization
    db.query.checkInRequests.findMany({
      where: and(
        eq(checkInRequests.organizationId, organizationId),
        eq(checkInRequests.status, "pending")
      ),
      columns: { id: true },
    }),
    // Count stale shifts (open > 16 hours)
    db.query.shifts.findMany({
      where: and(
        eq(shifts.organizationId, organizationId),
        eq(shifts.status, "stale")
      ),
      columns: { id: true },
    }),
  ]);

  return {
    pendingRequests: pendingRequests.length,
    staleShifts: staleShifts.length,
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  // Get the user's organization
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { organizationId: true },
  });

  const badgeCounts = user?.organizationId
    ? await getBadgeCounts(user.organizationId)
    : { pendingRequests: 0, staleShifts: 0 };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={session.user} badgeCounts={badgeCounts} />
      <main className="flex-1 overflow-y-auto bg-muted/30">
        {children}
      </main>
    </div>
  );
}

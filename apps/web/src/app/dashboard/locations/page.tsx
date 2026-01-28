import { db, eq } from "@timezone/database";
import { orgLocations, users } from "@timezone/database/schema";
import { requireAuth } from "@/lib/auth-server";
import { LocationsClient } from "./locations-client";

async function getLocations(organizationId: string) {
  const locations = await db.query.orgLocations.findMany({
    where: eq(orgLocations.organizationId, organizationId),
    orderBy: [orgLocations.isPrimary, orgLocations.createdAt],
  });

  return locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    address: loc.address,
    latitude: Number(loc.latitude),
    longitude: Number(loc.longitude),
    radiusMeters: loc.radiusMeters || 200,
    isActive: loc.isActive ?? true,
    isPrimary: loc.isPrimary ?? false,
    createdAt: loc.createdAt.toISOString(),
  }));
}

export default async function LocationsPage() {
  const session = await requireAuth();

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { organizationId: true, role: true },
  });

  if (!user?.organizationId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No organization found</p>
      </div>
    );
  }

  const isAdmin = ["org_admin", "super_admin"].includes(user.role);
  const locations = await getLocations(user.organizationId);

  return (
    <LocationsClient
      locations={locations}
      organizationId={user.organizationId}
      canEdit={isAdmin}
    />
  );
}

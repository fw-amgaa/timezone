"use server";

import { z } from "zod";
import { db, eq, desc } from "@timezone/database";
import { organizations, users } from "@timezone/database/schema";
import { sendOrgAdminInvite } from "@/lib/email";
import { getSession } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import { auth } from "../auth";

/**
 * ORGANIZATIONS SERVER ACTIONS
 *
 * Server actions for organization management (super admin only).
 */

// Schema for creating an organization
const createOrgSchema = z.object({
  // Organization details
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens"
    )
    .optional(),
  description: z.string().optional(),

  // Contact
  email: z
    .string()
    .email("Invalid organization email")
    .optional()
    .or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),

  // Address
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),

  // Location for geofencing
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),

  // Subscription
  subscriptionTier: z
    .enum(["free", "starter", "professional", "enterprise"])
    .default("free"),
  maxEmployees: z.number().min(1).default(10),

  // Admin details (required)
  admin: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid admin email"),
    phone: z.string().optional(),
    position: z.string().optional(),
  }),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;

// Generate a URL-friendly slug from organization name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// Get all organizations (super admin only)
export async function getOrganizations() {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const userRole = (session.user as any).role;
  if (userRole !== "super_admin") {
    return { success: false, error: "Forbidden - Super admin access required" };
  }

  try {
    const orgs = await db.query.organizations.findMany({
      orderBy: [desc(organizations.createdAt)],
    });

    // Get admin and employee counts for each organization
    const orgsWithStats = await Promise.all(
      orgs.map(async (org) => {
        const orgUsers = await db
          .select()
          .from(users)
          .where(eq(users.organizationId, org.id));

        const adminCount = orgUsers.filter(
          (u) => u.role === "org_admin"
        ).length;
        const employeeCount = orgUsers.length;

        return {
          ...org,
          adminCount,
          employeeCount,
        };
      })
    );

    return { success: true, organizations: orgsWithStats };
  } catch (error) {
    console.error("Get organizations error:", error);
    return { success: false, error: "Failed to fetch organizations" };
  }
}

// Create a new organization with org admin
export async function createOrganization(input: CreateOrgInput) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const userRole = (session.user as any).role;
  if (userRole !== "super_admin") {
    return { success: false, error: "Forbidden - Super admin access required" };
  }

  try {
    const data = createOrgSchema.parse(input);

    // Generate slug if not provided
    const slug = data.slug || generateSlug(data.name);

    // Check if slug already exists
    const existingOrg = await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    });

    if (existingOrg) {
      return {
        success: false,
        error: "An organization with this slug already exists",
      };
    }

    // Check if admin email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, data.admin.email),
    });

    if (existingUser) {
      return {
        success: false,
        error: "A user with this email already exists",
      };
    }

    // Create the organization
    const [newOrg] = await db
      .insert(organizations)
      .values({
        name: data.name,
        slug,
        description: data.description,
        email: data.email || null,
        phone: data.phone,
        website: data.website || null,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        latitude: data.latitude?.toString(),
        longitude: data.longitude?.toString(),
        subscriptionTier: data.subscriptionTier,
        maxEmployees: data.maxEmployees,
        isActive: true,
      })
      .returning();

    // Default password for testing
    const defaultPassword = "12345678";

    // Create the org admin user using Better Auth's signUpEmail
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: data.admin.email,
        password: defaultPassword,
        name: `${data.admin.firstName} ${data.admin.lastName}`,
        firstName: data.admin.firstName,
        lastName: data.admin.lastName,
        role: "org_admin",
        organizationId: newOrg.id,
        position: data.admin.position || "Organization Admin",
        phone: data.admin.phone || undefined,
        isActive: true,
      },
    });

    if (!signUpResult.user) {
      // Rollback: delete the organization if user creation failed
      await db.delete(organizations).where(eq(organizations.id, newOrg.id));
      return {
        success: false,
        error: "Failed to create admin user",
      };
    }

    const newUser = signUpResult.user;

    // Update user with invitation metadata
    await db
      .update(users)
      .set({
        emailVerified: true, // Pre-verified for invited users
        invitedAt: new Date(),
        invitedBy: session.user.id,
      })
      .where(eq(users.id, newUser.id));

    // Send invitation email
    let emailSent = false;
    let emailError: string | null = null;

    // try {
    //   await sendOrgAdminInvite({
    //     to: data.admin.email,
    //     firstName: data.admin.firstName,
    //     lastName: data.admin.lastName,
    //     organizationName: data.name,
    //     tempPassword: defaultPassword,
    //   });
    //   emailSent = true;
    // } catch (err) {
    //   console.error("Failed to send invitation email:", err);
    //   emailError = err instanceof Error ? err.message : "Unknown email error";
    // }

    // Revalidate the organizations page
    revalidatePath("/dashboard/organizations");

    return {
      success: true,
      organization: newOrg,
      admin: {
        id: newUser.id,
        email: newUser.email,
        firstName: (newUser as any).firstName || data.admin.firstName,
        lastName: (newUser as any).lastName || data.admin.lastName,
        role: (newUser as any).role || "org_admin",
      },
      emailSent,
      emailError,
      message: emailSent
        ? `Organization created successfully. An invitation email has been sent to ${data.admin.email}.`
        : `Organization created successfully. Note: Failed to send invitation email - ${emailError}. Please share the login credentials manually: Email: ${data.admin.email}, Password: ${defaultPassword}`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Validation error",
        details: error.errors,
      };
    }

    console.error("Create organization error:", error);
    return { success: false, error: "Failed to create organization" };
  }
}

// Toggle organization active status
export async function toggleOrganizationStatus(orgId: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const userRole = (session.user as any).role;
  if (userRole !== "super_admin") {
    return { success: false, error: "Forbidden - Super admin access required" };
  }

  try {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) {
      return { success: false, error: "Organization not found" };
    }

    const [updated] = await db
      .update(organizations)
      .set({
        isActive: !org.isActive,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
      .returning();

    revalidatePath("/dashboard/organizations");

    return {
      success: true,
      organization: updated,
      message: updated.isActive
        ? "Organization activated successfully"
        : "Organization deactivated successfully",
    };
  } catch (error) {
    console.error("Toggle organization status error:", error);
    return { success: false, error: "Failed to update organization status" };
  }
}

// Delete organization
export async function deleteOrganization(orgId: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const userRole = (session.user as any).role;
  if (userRole !== "super_admin") {
    return { success: false, error: "Forbidden - Super admin access required" };
  }

  try {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) {
      return { success: false, error: "Organization not found" };
    }

    // Delete organization (users will be cascade deleted due to FK constraint)
    await db.delete(organizations).where(eq(organizations.id, orgId));

    revalidatePath("/dashboard/organizations");

    return {
      success: true,
      message: "Organization deleted successfully",
    };
  } catch (error) {
    console.error("Delete organization error:", error);
    return { success: false, error: "Failed to delete organization" };
  }
}

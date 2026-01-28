"use server";

import { z } from "zod";
import { db, eq, and, desc } from "@timezone/database";
import { users, shifts } from "@timezone/database/schema";
import { getSession } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";

/**
 * EMPLOYEE SERVER ACTIONS
 *
 * Server actions for employee management (org_admin and org_manager).
 */

// Schema for creating an employee
const createEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(8, "Phone number is required"),
  position: z.string().optional(),
  registrationNumber: z.string().optional(),
  role: z.enum(["employee", "org_manager"]).default("employee"),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// Schema for updating an employee
const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

/**
 * Get the current user's organization ID
 */
async function getOrgId(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  const userRole = (session.user as any).role;
  const userOrgId = (session.user as any).organizationId;

  // Only org_admin and org_manager can manage employees
  if (!["org_admin", "org_manager"].includes(userRole)) {
    return null;
  }

  return userOrgId;
}

/**
 * Get all employees for the current organization
 */
export async function getEmployees() {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = await getOrgId();
  if (!orgId) {
    return { success: false, error: "Forbidden - Admin access required" };
  }

  try {
    // Get all users in the organization
    const employees = await db.query.users.findMany({
      where: eq(users.organizationId, orgId),
      orderBy: [desc(users.createdAt)],
    });

    // Get shift status and hours for each employee
    const employeesWithStats = await Promise.all(
      employees.map(async (emp) => {
        // Get current open shift (if any)
        const openShift = await db.query.shifts.findFirst({
          where: and(
            eq(shifts.userId, emp.id),
            eq(shifts.status, "open")
          ),
        });

        // Calculate hours this week
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const weekShifts = await db.query.shifts.findMany({
          where: and(
            eq(shifts.userId, emp.id),
            eq(shifts.status, "closed")
          ),
        });

        const hoursThisWeek = weekShifts
          .filter((s) => new Date(s.clockInAt) >= weekStart)
          .reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / 60;

        // Determine status
        let status: "clocked_in" | "clocked_out" | "inactive" = "clocked_out";
        if (!emp.isActive) {
          status = "inactive";
        } else if (openShift) {
          status = "clocked_in";
        }

        // Format last active
        let lastActive = "Never";
        if (emp.lastActiveAt) {
          const diff = Date.now() - new Date(emp.lastActiveAt).getTime();
          const minutes = Math.floor(diff / 60000);
          if (minutes < 1) lastActive = "Now";
          else if (minutes < 60) lastActive = `${minutes} minutes ago`;
          else if (minutes < 1440) lastActive = `${Math.floor(minutes / 60)} hours ago`;
          else lastActive = `${Math.floor(minutes / 1440)} days ago`;
        }

        return {
          id: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          phone: emp.phone,
          position: emp.position,
          registrationNumber: emp.registrationNumber,
          role: emp.role,
          isActive: emp.isActive,
          status,
          hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
          lastActive,
          hasPassword: !!emp.passwordHash,
          phoneVerified: emp.phoneVerified,
          createdAt: emp.createdAt,
        };
      })
    );

    return { success: true, employees: employeesWithStats };
  } catch (error) {
    console.error("Get employees error:", error);
    return { success: false, error: "Failed to fetch employees" };
  }
}

/**
 * Create a new employee (no password - they set it on first mobile login)
 */
export async function createEmployee(input: CreateEmployeeInput) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = await getOrgId();
  if (!orgId) {
    return { success: false, error: "Forbidden - Admin access required" };
  }

  try {
    const data = createEmployeeSchema.parse(input);

    // Clean phone number
    const cleanPhone = data.phone.replace(/\D/g, "");

    // Check if phone already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.phone, cleanPhone),
    });

    if (existingUser) {
      return {
        success: false,
        error: "A user with this phone number already exists",
      };
    }

    // Create the employee (no password - they set it on first mobile login)
    const [newEmployee] = await db
      .insert(users)
      .values({
        organizationId: orgId,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
        name: `${data.firstName} ${data.lastName}`,
        phone: cleanPhone,
        position: data.position,
        registrationNumber: data.registrationNumber,
        isActive: true,
        invitedAt: new Date(),
        invitedBy: session.user.id,
      })
      .returning();

    revalidatePath("/dashboard/employees");

    return {
      success: true,
      employee: {
        id: newEmployee.id,
        firstName: newEmployee.firstName,
        lastName: newEmployee.lastName,
        phone: newEmployee.phone,
        position: newEmployee.position,
        role: newEmployee.role,
      },
      message: `Employee ${data.firstName} ${data.lastName} added successfully. They can now register on the mobile app using their phone number.`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Validation error",
        details: error.errors,
      };
    }

    console.error("Create employee error:", error);
    return { success: false, error: "Failed to create employee" };
  }
}

/**
 * Update an employee
 */
export async function updateEmployee(input: UpdateEmployeeInput) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = await getOrgId();
  if (!orgId) {
    return { success: false, error: "Forbidden - Admin access required" };
  }

  try {
    const data = updateEmployeeSchema.parse(input);

    // Verify employee belongs to this organization
    const employee = await db.query.users.findFirst({
      where: and(eq(users.id, data.id), eq(users.organizationId, orgId)),
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName;
      updateData.name = `${data.firstName} ${data.lastName || employee.lastName}`;
    }
    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName;
      updateData.name = `${data.firstName || employee.firstName} ${data.lastName}`;
    }
    if (data.phone !== undefined) {
      const cleanPhone = data.phone.replace(/\D/g, "");
      // Check if new phone already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.phone, cleanPhone),
      });
      if (existingUser && existingUser.id !== data.id) {
        return {
          success: false,
          error: "A user with this phone number already exists",
        };
      }
      updateData.phone = cleanPhone;
    }
    if (data.position !== undefined) updateData.position = data.position;
    if (data.registrationNumber !== undefined)
      updateData.registrationNumber = data.registrationNumber;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, data.id))
      .returning();

    revalidatePath("/dashboard/employees");

    return {
      success: true,
      employee: updated,
      message: "Employee updated successfully",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Validation error",
        details: error.errors,
      };
    }

    console.error("Update employee error:", error);
    return { success: false, error: "Failed to update employee" };
  }
}

/**
 * Delete (deactivate) an employee
 */
export async function deleteEmployee(employeeId: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const userRole = (session.user as any).role;
  if (userRole !== "org_admin") {
    return { success: false, error: "Forbidden - Only admins can delete employees" };
  }

  const orgId = await getOrgId();
  if (!orgId) {
    return { success: false, error: "Forbidden - Admin access required" };
  }

  try {
    // Verify employee belongs to this organization
    const employee = await db.query.users.findFirst({
      where: and(eq(users.id, employeeId), eq(users.organizationId, orgId)),
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    // Soft delete - set isActive to false
    await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, employeeId));

    revalidatePath("/dashboard/employees");

    return {
      success: true,
      message: "Employee deactivated successfully",
    };
  } catch (error) {
    console.error("Delete employee error:", error);
    return { success: false, error: "Failed to delete employee" };
  }
}

"use server";

import { db, Prisma } from "@app/db";
import { validatePermission } from "./permissions";
import { p } from "@app/api/permissions";
import { validate } from "./validations";
import { ROLE_ROOT, ROLE_USER } from "@app/api/roles";

export type Role = Prisma.RoleGetPayload<{
  select: {
    id: true;
    name: true;
    label: true;
    permissions: {
      select: {
        id: true;
        name: true;
        label: true;
      };
    };
  };
}>;

export async function listRoles(): Promise<{ data?: Role[]; error?: string }> {
  //* VALIDATE SESSION
  const result = await validatePermission(p.roles.list);
  if (!result.hasPermission) {
    return { data: [], error: result.error };
  }

  //* RUN QUERY
  console.log("[⌛listRoles] Running query");
  try {
    const rolesList = await db.role.findMany({
      select: {
        id: true,
        name: true,
        label: true,
        permissions: {
          select: {
            id: true,
            name: true,
            label: true,
          },
        },
      },
    });
    console.log(
      `[✅listRoles] ${rolesList.length} Roles fetched successfully`,
    );
    return { data: rolesList };
  } catch (error) {
    console.log(`[❌listRoles] Error listing roles: ${error}`);
    return { error: "Error listing roles" };
  }
}

export async function getRole(name: string) {
  const { hasPermission } = await validatePermission(p.roles.read);
  if (!hasPermission) {
    return { error: "You don't have permission to perform this action" };
  }
  try {
    const role = await db.role.findUnique({
      where: {
        name: name,
      },
    });
    return role;
  } catch (error) {
    console.error("Error fetching role:", error);
    return { error: "Error fetching role" };
  }
}

export async function getRolePermissions(roleName: string) {
  if (!roleName) {
    return [];
  }
  const { hasPermission } = await validatePermission(p.roles.read);
  if (!hasPermission) {
    return [];
  }
  try {
    const res = await db.role.findUnique({
      where: {
        name: roleName,
      },
      select: {
        permissions: true,
      },
    });
    if (!res) {
      throw new Error("No data found");
    }
    const permissions = res.permissions.map((permission) => permission.name);

    return permissions;
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes(
          "PrismaClient is unable to run in this browser environment",
        )
      ) {
        return [];
      }
    }
    console.error("[roles] getRolePermissions failed");
    return [];
  }
}

export async function updateRole({
  prop,
  value,
  id,
}: {
  prop: keyof Role;
  value: string;
  id: number;
}) {
  console.log("Updating Role");
  const { hasPermission } = await validatePermission(p.roles.update);
  if (!hasPermission) {
    console.log("You don't have permission to edit roles");
    return { error: "You don't have permission to edit roles" };
  }
  const ALLOWED_PROPS = ["name", "label"] as const;
  if (!ALLOWED_PROPS.includes(prop as any)) {
    return { error: "Field not allowed in role update" };
  }
  const existingRole = await db.role.findUnique({ where: { id } });
  if (!existingRole) {
    return { error: "Role not found" };
  }
  if (
    (existingRole.name === ROLE_ROOT || existingRole.name === ROLE_USER) &&
    prop === "name"
  ) {
    return { error: "Cannot change the name of system roles" };
  }
  try {
    await db.role.update({
      where: {
        id: id,
      },
      data: {
        [prop]: value,
      },
    });
    console.log("Role updated successfully");
    return { success: "Role updated successfully" };
  } catch (error) {
    console.error("Error updating role:", error);
    return { error: "Error updating role" };
  }
}

export async function createRole({
  name,
  label,
}: {
  name: string;
  label: string;
}) {
  console.log("Creating Role");
  const { hasPermission } = await validatePermission(p.roles.create);
  if (!hasPermission) {
    console.log("You don't have permission to create roles");
    return { error: "You don't have permission to create roles" };
  }
  try {
    await db.role.create({
      data: {
        name: name,
        label: label,
      },
    });
    console.log("Role created successfully");
    return { success: "Role created successfully" };
  } catch (error) {
    console.error("Error creating role:", error);
    return { error: "Error creating role" };
  }
}

export async function deleteRole(id: number) {
  console.log("Deleting Role");
  const { hasPermission } = await validatePermission(p.roles.delete);
  if (!hasPermission) {
    console.log("You don't have permission to delete roles");
    return { error: "You don't have permission to delete roles" };
  }
  const existingRole = await db.role.findUnique({ where: { id } });
  if (!existingRole) {
    return { error: "Role not found" };
  }
  if (existingRole.name === ROLE_ROOT || existingRole.name === ROLE_USER) {
    return { error: "System roles cannot be deleted" };
  }
  try {
    await db.role.delete({
      where: {
        id: id,
      },
    });
    console.log("Role deleted successfully");
    return { success: "Role deleted successfully" };
  } catch (error) {
    console.error("Error deleting role:", error);
    return { error: "Error deleting role" };
  }
}

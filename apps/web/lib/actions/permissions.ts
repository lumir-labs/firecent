"use server";
import { db, Prisma } from "@app/db";
import type { permissionSchema } from "@app/lib";
import type { z } from "zod";
import { getServerSession, type Session } from "../auth";
import { p, type PermissionKey } from "@app/api/permissions";
import { ROLE_ROOT } from "@app/api/roles";
import { detectPermissionEscalationRisk, type EscalationRisk } from "@app/api";
export type { EscalationRisk };

export type PermissionWithRoles = Prisma.PermissionGetPayload<{
  select: {
    id: true;
    name: true;
    label: true;
    description: true;
    roles: {
      select: {
        id: true;
      };
    };
  };
}>;

export async function listPermissions(): Promise<{
  data?: PermissionWithRoles[];
  error?: string;
}> {
  //* VALIDATE SESSION
  const result = await validatePermission(p.permissions.list);
  if (!result.hasPermission) {
    console.log(
      "[❌listPermissions] You don't have permission to perform this action",
    );
    return { data: [], error: result.error };
  }

  //* RUN QUERY
  console.log("[⌛listPermissions] Running query");
  try {
    const permissionsList = await db.permission.findMany({
      select: {
        id: true,
        name: true,
        label: true,
        description: true,
        roles: {
          select: {
            id: true,
          },
        },
      },
    });
    console.log(
      `[✅listPermissions] ${permissionsList.length} Permissions fetched successfully`,
    );
    return { data: permissionsList };
  } catch (error) {
    console.log(`[❌listPermissions] Error listing permissions: ${error}`);
    return { error: "Error listing permissions" };
  }
}

export async function createPermission(
  data: z.infer<typeof permissionSchema>,
): Promise<{ error?: string } | Record<string, unknown>> {
  //* VALIDATE SESSION
  const { hasPermission } = await validatePermission(p.permissions.create);
  if (!hasPermission) {
    console.log(
      "[❌createPermission] You don't have permission to perform this action",
    );
    return { error: "You don't have permission to perform this action" };
  }

  if (!data.name) {
    return { error: "Name is required" };
  }
  if (!data.label) {
    return { error: "Label is required" };
  }

  await db.permission.create({
    data: {
      name: data.name,
      label: data.label,
      description: data.description,
      roles:
        data.roles_ids && data.roles_ids.length > 0
          ? {
              connect: data.roles_ids.map((id) => ({ id: Number(id) })),
            }
          : undefined,
    },
  });
  return {};
}

export async function createMissingPermissions(
  permissions: { name: string; label: string; description?: string }[],
): Promise<{ error?: string; count?: number }> {
  const { hasPermission, session } = await validatePermission(
    p.permissions.create,
  );
  if (!hasPermission || !session) {
    return { error: "You don't have permission to perform this action" };
  }

  if (!permissions || permissions.length === 0) {
    return { error: "No permissions were provided to create" };
  }

  const roleIds =
    session.user.roles
      ?.map((role) => ({ id: Number(role) }))
      .filter((r) => !isNaN(r.id)) || [];

  try {
    const count = await db.$transaction(
      async (tx) => {
        // 1. Create all permissions in bulk
        await tx.permission.createMany({
          data: permissions.map((p) => ({
            name: p.name,
            label: p.label,
            description: p.description,
          })),
          skipDuplicates: true,
        });

        // 2. Link created permissions to the root role
        const rootRole = await tx.role.findUnique({
          where: { name: ROLE_ROOT },
          select: { id: true },
        });

        if (rootRole) {
          const createdPerms = await tx.permission.findMany({
            where: {
              name: { in: permissions.map((p) => p.name) },
            },
            select: { id: true },
          });

          await tx.role.update({
            where: { id: rootRole.id },
            data: {
              permissions: {
                connect: createdPerms.map((p) => ({ id: p.id })),
              },
            },
          });
        }

        return permissions.length;
      },
      {
        timeout: 30000,
      },
    );

    return { count };
  } catch (error) {
    console.log(`[❌createMissingPermissions] Error: ${error}`);
    return { error: "Error creating the missing permissions" };
  }
}

export async function deletePermission(
  id: number,
): Promise<{ error?: string }> {
  const { hasPermission } = await validatePermission(p.permissions.delete);
  if (!hasPermission) {
    return { error: "You don't have permission to perform this action" };
  }
  try {
    await db.permission.delete({
      where: {
        id: id,
      },
    });
    return {};
  } catch (error) {
    console.log(`[❌deletePermission] Error deleting permission: ${error}`);
    return { error: "Error deleting the permission" };
  }
}

export async function deleteUnusedPermissions(
  ids: number[],
): Promise<{ error?: string; count?: number }> {
  const { hasPermission } = await validatePermission(p.permissions.delete);
  if (!hasPermission) {
    return { error: "You don't have permission to perform this action" };
  }

  try {
    const result = await db.permission.deleteMany({
      where: {
        id: { in: ids },
      },
    });
    return { count: result.count };
  } catch (error) {
    console.log(`[❌deleteUnusedPermissions] Error: ${error}`);
    return { error: "Error deleting the unused permissions" };
  }
}

export async function updatePermission({
  prop,
  value,
  id,
}: {
  prop: keyof PermissionWithRoles;
  value: string;
  id: number;
}): Promise<{ error?: string }> {
  const { hasPermission } = await validatePermission(p.permissions.update);
  if (!hasPermission) {
    return { error: "You don't have permission to perform this action" };
  }
  const ALLOWED_PROPS = ["label", "description"] as const;
  if (!ALLOWED_PROPS.includes(prop as any)) {
    return { error: "Field not allowed in permission update" };
  }
  try {
    await db.permission.update({
      where: {
        id: id,
      },
      data: {
        [prop]: value,
      },
    });
    return {};
  } catch (error) {
    console.log(error);
    return { error: "Error updating the permission" };
  }
}

export async function updatePermissionLabel(
  permissionId: number,
  label: string,
): Promise<{ error?: string }> {
  const { hasPermission } = await validatePermission(p.permissions.update);
  if (!hasPermission) {
    return { error: "You don't have permission to perform this action" };
  }
  await db.permission.update({
    where: {
      id: permissionId,
    },
    data: {
      label: label,
    },
  });
  return {};
}

export async function updateRolePermission(
  roleId: number,
  permissionId: number,
  action: "add" | "remove",
) {
  const { hasPermission, session } = await validatePermission(p.permissions.update);
  if (!hasPermission || !session) {
    throw new Error("You don't have permission to perform this action");
  }

  const targetRole = await db.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      name: true,
      permissions: { select: { name: true } },
    },
  });
  if (!targetRole) {
    throw new Error("Role not found");
  }

  const targetPerm = await db.permission.findUnique({
    where: { id: permissionId },
    select: { id: true, name: true },
  });
  if (!targetPerm) {
    throw new Error("Permission not found");
  }

  const rootRole = await db.role.findUnique({
    where: { name: ROLE_ROOT },
    select: { id: true },
  });
  const callerIsRoot = rootRole
    ? session.user.roles.some((r) => Number(r) === rootRole.id)
    : false;

  if (targetRole.name === ROLE_ROOT && action === "remove") {
    throw new Error("Cannot remove permissions from the root role");
  }

  if (!callerIsRoot) {
    const callerHasTargetRole = session.user.roles.some(
      (r) => Number(r) === roleId,
    );
    if (callerHasTargetRole) {
      throw new Error("You cannot modify permissions for a role you belong to");
    }

    if (action === "add") {
      if (!session.user.permissions.includes(targetPerm.name)) {
        throw new Error(
          "You cannot grant a permission that you do not possess yourself",
        );
      }
    }
  }

  let escalationWarning: EscalationRisk | null = null;
  if (action === "add") {
    escalationWarning = detectPermissionEscalationRisk({
      roleName: targetRole.name,
      currentPermissionKeys: targetRole.permissions.map((p) => p.name),
      newPermissionKey: targetPerm.name,
    });
    if (escalationWarning) {
      console.warn("[⚠️ ESCALATION RISK DETECTED]", {
        roleId,
        roleName: targetRole.name,
        permission: targetPerm.name,
        risk: escalationWarning,
      });
    }
  }

  try {
    if (action === "add") {
      await db.role.update({
        where: {
          id: roleId,
        },
        data: {
          permissions: {
            connect: {
              id: permissionId,
            },
          },
        },
      });
      return { success: true, warning: escalationWarning };
    } else {
      await db.role.update({
        where: {
          id: roleId,
        },
        data: {
          permissions: {
            disconnect: {
              id: permissionId,
            },
          },
        },
      });
      return { success: true, warning: null };
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function validatePermission(
  permission: PermissionKey,
): Promise<
  | { hasPermission: true; session: Session }
  | { hasPermission: false; session: null; error: string }
> {
  const session = await getServerSession();
  if (!session?.user) {
    console.log("[🔒] Not Authenticated");
    return {
      hasPermission: false,
      session: null,
      error: "[Not Authenticated] You don't have permission to perform this action",
    };
  }

  const hasPermission = session.user.permissions.includes(permission.key);
  if (!hasPermission) {
    return {
      hasPermission: false,
      session: null,
      error: "[Not has permission] You don't have permission to perform this action",
    };
  }
  return { hasPermission: true, session: session };
}

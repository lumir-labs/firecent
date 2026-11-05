// Role/permission sync helpers (server-only).
// Used by both `lib/auth.ts` (on user creation) and `scripts/seed.ts`,
// so there is a single implementation of "which permissions each role has".
import { db } from "@app/db";
import {
  getAllPermissions,
  getRoleDefinition,
  ROLE_DEFINITIONS,
  resolveRolePermissions,
  type RoleDefinition,
} from "@app/api/roles";

/**
 * Permission payload for a role. `connectOrCreate` by (unique) `name` makes
 * it work both on a freshly migrated DB and an existing one, without
 * duplicating rows.
 */
function permissionOps(role: RoleDefinition) {
  return resolveRolePermissions(role).map((permission) => ({
    where: { name: permission.key },
    create: {
      name: permission.key,
      label: permission.label,
      description: permission.description,
    },
  }));
}

/**
 * Creates the role if it doesn't exist and ensures it has the permissions of
 * its definition.
 * Idempotent: can be called on every user sign-up at negligible cost.
 */
export async function ensureRole(name: string) {
  const definition = getRoleDefinition(name);
  if (!definition) {
    throw new Error(
      `Role "${name}" is not defined in ROLE_DEFINITIONS (@app/api/roles)`,
    );
  }

  const permissions = permissionOps(definition);

  return db.role.upsert({
    where: { name: definition.name },
    update: {
      label: definition.label,
      permissions: { connectOrCreate: permissions },
    },
    create: {
      name: definition.name,
      label: definition.label,
      permissions: { connectOrCreate: permissions },
    },
  });
}

/** Syncs every role declared in `ROLE_DEFINITIONS`. */
export async function ensureAllRoles() {
  return Promise.all(
    ROLE_DEFINITIONS.map((definition) => ensureRole(definition.name)),
  );
}

/**
 * Syncs the permission catalog against the `Permission` table:
 * creates the missing ones and updates label/description of existing ones.
 */
export async function syncPermissionCatalog(): Promise<{
  created: number;
  updated: number;
  total: number;
}> {
  const catalog = getAllPermissions();
  const existing = await db.permission.findMany({
    select: { name: true, label: true, description: true },
  });
  const byName = new Map(existing.map((permission) => [permission.name, permission]));

  let created = 0;
  let updated = 0;

  for (const permission of catalog) {
    const current = byName.get(permission.key);

    if (!current) {
      await db.permission.create({
        data: {
          name: permission.key,
          label: permission.label,
          description: permission.description,
        },
      });
      created++;
      continue;
    }

    const labelChanged = current.label !== permission.label;
    const descriptionChanged =
      (current.description ?? "") !== permission.description;

    if (labelChanged || descriptionChanged) {
      await db.permission.update({
        where: { name: permission.key },
        data: {
          label: permission.label,
          description: permission.description,
        },
      });
      updated++;
    }
  }

  return { created, updated, total: catalog.length };
}

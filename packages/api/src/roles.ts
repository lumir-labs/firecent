// Single source of truth for the boilerplate's roles.
// Permissions live in ./permissions.ts (the `p` catalog); this file only
// declares WHICH permissions each role receives. Consumers:
//   - apps/web/lib/auth.ts      -> default role when creating a user
//   - apps/web/lib/roles.ts     -> ensureRole / syncPermissionCatalog helpers
//   - apps/web/scripts/seed.ts  -> idempotent seed (permissions + roles + root)
import {
  getDefinedPermissionsGrouped,
  p,
  type DefinedPermission,
} from "./permissions";

export const ROLE_ROOT = "root";
export const ROLE_USER = "user";

/** `"all"` = the entire catalog; or an explicit list of permission keys. */
export type RolePermissionRef = "all" | readonly string[];

export type RoleDefinition = {
  name: string;
  label: string;
  description: string;
  permissions: RolePermissionRef;
};

/**
 * Base roles. Every new user receives `ROLE_USER` (minimal access).
 * `ROLE_ROOT` is NOT assigned automatically: it is granted via the seed
 * (`bun run db:seed -- --email=...`) or from the admin panel.
 */
export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    name: ROLE_ROOT,
    label: "Root user",
    description: "Full access to the system",
    permissions: "all",
  },
  {
    name: ROLE_USER,
    label: "User",
    description: "Base access: dashboard, organization and API keys",
    permissions: [
      p.apikeys.menu.key,
      p.apikeys.list.key,
      p.apikeys.create.key,
      p.apikeys.revoke.key,
      p.organizations.read.key,
      // Any member can invite and list invites (team self-service, Slack
      // style). Canceling stays privileged (`organization-members:delete`
      // is NOT included on purpose).
      p.organizationMembers.list.key,
      p.organizationMembers.create.key,
    ],
  },
];

/** The entire permission catalog, flattened (with its category). */
export function getAllPermissions(): DefinedPermission[] {
  return Object.values(getDefinedPermissionsGrouped()).flat();
}

/** Concrete permissions a role must have according to its definition. */
export function resolveRolePermissions(
  role: RoleDefinition,
): DefinedPermission[] {
  const all = getAllPermissions();
  if (role.permissions === "all") return all;

  const keys = new Set<string>(role.permissions);
  return all.filter((permission) => keys.has(permission.key));
}

/** Returns a role's definition by name (or `undefined`). */
export function getRoleDefinition(name: string): RoleDefinition | undefined {
  return ROLE_DEFINITIONS.find((role) => role.name === name);
}

/**
 * Keys declared in `ROLE_DEFINITIONS` that do NOT exist in the `p` catalog.
 * Serves as a safety net: a typo here would silently leave the role without
 * that permission. Used by `apps/web/scripts/seed.ts`.
 */
export function getUnknownRolePermissionKeys(): string[] {
  const known = new Set(getAllPermissions().map((permission) => permission.key));
  const unknown = new Set<string>();

  for (const role of ROLE_DEFINITIONS) {
    if (role.permissions === "all") continue;
    for (const key of role.permissions) {
      if (!known.has(key)) unknown.add(key);
    }
  }

  return [...unknown];
}

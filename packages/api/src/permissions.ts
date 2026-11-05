// Single source of truth for the boilerplate's permissions (no app domain).
// The value is still the key's string, with metadata attached.
function def(key: string, name: string, description: string) {
  return Object.assign(key, { key, name, description });
}

export const p = {
  dashboard: {
    basic: def(
      "dashboard:basic",
      "Basic Plan",
      "Allows basic access to the dashboard menu",
    ),
    premium: def(
      "dashboard:premium",
      "Premium Plan",
      "Advanced access to the dashboard menu",
    ),
  },
  permissions: {
    menu: def(
      "permissions:menu",
      "Permissions menu",
      "Allows accessing the permissions menu",
    ),
    list: def(
      "permissions:list",
      "List permissions",
      "Allows reading the permissions list",
    ),
    read: def(
      "permissions:read",
      "Read permissions",
      "Allows reading permissions",
    ),
    create: def(
      "permissions:create",
      "Create permissions",
      "Allows creating permissions",
    ),
    update: def(
      "permissions:update",
      "Update permissions",
      "Allows updating permissions",
    ),
    delete: def(
      "permissions:delete",
      "Delete permissions",
      "Allows deleting permissions",
    ),
  },
  roles: {
    menu: def("roles:menu", "Roles menu", "Allows accessing the roles menu"),
    list: def("roles:list", "List roles", "Allows reading the roles list"),
    read: def("roles:read", "Read role", "Allows reading roles"),
    create: def("roles:create", "Create roles", "Allows creating roles"),
    update: def("roles:update", "Update roles", "Allows updating roles"),
    delete: def("roles:delete", "Delete roles", "Allows deleting roles"),
    view_as: def("roles:view_as", "View as role", "Allows viewing as a role"),
  },
  users: {
    menu: def("users:menu", "Users menu", "Allows accessing the users menu"),
    read: def("users:read", "Read users", "Allows reading users"),
    create: def("users:create", "Create users", "Allows creating users"),
    update: def("users:update", "Update users", "Allows updating users"),
    delete: def("users:delete", "Delete users", "Allows deleting users"),
  },
  organizations: {
    menu: def(
      "organizations:menu",
      "Organizations menu",
      "Allows accessing the organizations menu",
    ),
    list: def(
      "organizations:list",
      "List organizations",
      "Allows reading the organizations list",
    ),
    read: def(
      "organizations:read",
      "Read organization",
      "Allows reading organizations",
    ),
    create: def(
      "organizations:create",
      "Create organization",
      "Allows creating organizations",
    ),
    update: def(
      "organizations:update",
      "Update organization",
      "Allows updating organizations",
    ),
    delete: def(
      "organizations:delete",
      "Delete organization",
      "Allows deleting organizations",
    ),
  },
  organizationMembers: {
    menu: def(
      "organization-members:menu",
      "Organization members menu",
      "Allows accessing the organization members menu",
    ),
    list: def(
      "organization-members:list",
      "List organization members",
      "Allows reading the organization members list",
    ),
    read: def(
      "organization-members:read",
      "Read organization member",
      "Allows reading organization members",
    ),
    create: def(
      "organization-members:create",
      "Create organization member",
      "Allows creating organization members",
    ),
    update: def(
      "organization-members:update",
      "Update organization member",
      "Allows updating organization members",
    ),
    delete: def(
      "organization-members:delete",
      "Delete organization member",
      "Allows deleting organization members",
    ),
  },
  apikeys: {
    menu: def(
      "apikeys:menu",
      "API keys menu",
      "Allows accessing the API keys menu",
    ),
    list: def(
      "apikeys:list",
      "List API keys",
      "Allows reading the API keys list",
    ),
    create: def(
      "apikeys:create",
      "Create API keys",
      "Allows creating API keys",
    ),
    revoke: def(
      "apikeys:revoke",
      "Revoke API keys",
      "Allows revoking API keys",
    ),
  },
} as const;

export type PermissionKey = {
  [Cat in keyof typeof p]: (typeof p)[Cat][keyof (typeof p)[Cat]];
}[keyof typeof p];

export interface DefinedPermission {
  category: string;
  key: string;
  label: string;
  description: string;
}

type PermissionItem = {
  key: string;
  name: string;
  description: string;
};

export function getDefinedPermissionsGrouped(): Record<
  string,
  DefinedPermission[]
> {
  const result: Record<string, DefinedPermission[]> = {};

  for (const [category, items] of Object.entries(p)) {
    result[category] = [];
    for (const item of Object.values(items as Record<string, PermissionItem>)) {
      const key = item.key || String(item);
      const label = item.name || key;
      const description = item.description || "";
      result[category].push({
        category,
        key,
        label,
        description,
      });
    }
  }

  return result;
}

export function getMissingPermissionsGrouped(
  existingNames: string[],
): Record<string, DefinedPermission[]> {
  const existingSet = new Set(existingNames);
  const allGrouped = getDefinedPermissionsGrouped();
  const missingGrouped: Record<string, DefinedPermission[]> = {};

  for (const [category, items] of Object.entries(allGrouped)) {
    const missingItems = items.filter((item) => !existingSet.has(item.key));
    if (missingItems.length > 0) {
      missingGrouped[category] = missingItems;
    }
  }

  return missingGrouped;
}

export function getUnusedPermissions<T extends { name: string }>(
  dbPermissions: T[],
): T[] {
  const allGrouped = getDefinedPermissionsGrouped();
  const definedKeys = new Set<string>();
  for (const items of Object.values(allGrouped)) {
    for (const item of items) {
      definedKeys.add(item.key);
    }
  }
  return dbPermissions.filter((perm) => !definedKeys.has(perm.name));
}

// Whitelist of fields editable via updateUser (boilerplate hardening).
// Allows profile scalars + legitimate relations (roles, memberships).
// Blocks mass-assignment of emailVerified/deletedAt/pwdReset/etc.
// `email` is ALSO blocked: changing the login without re-verification would
// leave a stale `emailVerified:true` on a never-verified email (a separate
// flow is pending with `emailVerified:false` + re-verification).
export const ALLOWED_USER_UPDATE_KEYS = [
  "firstName",
  "middleName",
  "lastName",
  "lastName2",
  "name",
  "image",
  "roles",
  "memberships",
] as const;

export type AllowedUserUpdateKey = (typeof ALLOWED_USER_UPDATE_KEYS)[number];

export function isUserUpdateAllowed(
  data: Record<string, unknown>,
): boolean {
  if (!data || typeof data !== "object") return false;
  const allowed = new Set<string>(ALLOWED_USER_UPDATE_KEYS);
  return Object.keys(data).every((k) => allowed.has(k));
}

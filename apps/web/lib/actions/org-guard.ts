// Active-org selection (boilerplate hardening).
// Respects the session's activeOrganizationId if it belongs to the memberships;
// otherwise falls back to memberships[0] (documented legacy behavior).
export function resolveActiveOrg(
  membershipIds: string[],
  activeOrganizationId: string | null | undefined,
): string | undefined {
  if (activeOrganizationId && membershipIds.includes(activeOrganizationId)) {
    return activeOrganizationId;
  }
  return membershipIds[0];
}

/** Scopes of the out-of-the-box MCP tools (§5.5 of the plan). */
export const MCP_ORG_READ = "mcp:org:read";
export const MCP_MEMBERS_READ = "mcp:members:read";

/**
 * Scopes a key is born with when created without explicit `scopes` (UI
 * without a selector). Deny-by-default still holds: explicit `[]` = no access.
 */
export const DEFAULT_MCP_SCOPES: string[] = [MCP_ORG_READ, MCP_MEMBERS_READ];

/** Context that a valid key injects into each tool (§5.3 step 4). */
export type OrgApiKeyContext = {
  keyId: string;
  orgId: string;
  userId: string;
  scopes: string[];
};

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@app/db";
import { MCP_ORG_READ, hasApiKeyScope } from "@app/api";
import type { McpAuthContext } from "../auth";

export const orgInfoInputSchema = z.object({});

export const orgInfoOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  memberCount: z.number(),
});

/**
 * Tool 1 (§5.5): `org.info` — `{ id, name, description, memberCount }` of the
 * key's org. Scope `mcp:org:read`.
 */
export function registerOrgInfoTool(
  server: McpServer,
  auth: McpAuthContext,
): void {
  server.registerTool(
    "org.info",
    {
      description:
        "Returns the id, name, description and member count of the organization that owns the API key.",
      inputSchema: orgInfoInputSchema.shape,
      outputSchema: orgInfoOutputSchema.shape,
    },
    async () => {
      if (!hasApiKeyScope(auth, MCP_ORG_READ)) {
        return {
          content: [
            { type: "text" as const, text: `Missing scope: ${MCP_ORG_READ}` },
          ],
          isError: true,
        };
      }
      const organization = await db.organization.findUnique({
        where: { id: auth.orgId },
        select: { id: true, name: true, description: true },
      });
      if (!organization) {
        return {
          content: [{ type: "text" as const, text: "Organization not found" }],
          isError: true,
        };
      }
      const memberCount = await db.member.count({
        where: { organizationId: auth.orgId },
      });
      const structuredOutput = {
        id: organization.id,
        name: organization.name,
        description: organization.description,
        memberCount,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredOutput) }],
        structuredOutput,
      };
    },
  );
}

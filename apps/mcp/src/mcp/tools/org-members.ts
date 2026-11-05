import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@app/db";
import { MCP_MEMBERS_READ, hasApiKeyScope } from "@app/api";
import type { McpAuthContext } from "../auth";

export const orgMembersListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const orgMemberSchema = z.object({
  userId: z.string(),
  email: z.string(),
  role: z.string(),
  joinedAt: z.string(),
});

export const orgMembersListOutputSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  members: z.array(orgMemberSchema),
});

/**
 * Tool 2 (§5.5): `org.members.list` — `{ userId, email, role, joinedAt }`
 * paginated (`page/limit`). Scope `mcp:members:read`.
 */
export function registerOrgMembersTool(
  server: McpServer,
  auth: McpAuthContext,
): void {
  server.registerTool(
    "org.members.list",
    {
      description:
        "Lists members of the organization that owns the API key, paginated with page/limit.",
      inputSchema: orgMembersListInputSchema.shape,
      outputSchema: orgMembersListOutputSchema.shape,
    },
    async ({ page, limit }) => {
      if (!hasApiKeyScope(auth, MCP_MEMBERS_READ)) {
        return {
          content: [
            { type: "text" as const, text: `Missing scope: ${MCP_MEMBERS_READ}` },
          ],
          isError: true,
        };
      }
      const [total, rows] = await Promise.all([
        db.member.count({ where: { organizationId: auth.orgId } }),
        db.member.findMany({
          where: { organizationId: auth.orgId },
          include: { user: { select: { id: true, email: true } } },
          orderBy: { createdAt: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);
      const structuredOutput = {
        page,
        limit,
        total,
        members: rows.map((row) => ({
          userId: row.userId,
          email: row.user.email,
          role: row.role,
          joinedAt: row.createdAt.toISOString(),
        })),
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredOutput) }],
        structuredOutput,
      };
    },
  );
}

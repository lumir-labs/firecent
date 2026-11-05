import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const healthInputSchema = z.object({});

export const healthOutputSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  time: z.string(),
});

/**
 * Tool 3 (§5.5): `service.health` — `{ ok, service:"mcp", time }`, NO auth
 * (same as `healthRouter.check` in `packages/api/src/routers/health.ts`).
 * Serves as a probe and as a template for a public tool.
 */
export function registerHealthTool(server: McpServer): void {
  server.registerTool(
    "service.health",
    {
      description:
        "Health probe of the MCP server. Takes no input, needs no API key.",
      inputSchema: healthInputSchema.shape,
      outputSchema: healthOutputSchema.shape,
    },
    async () => {
      const structuredOutput = {
        ok: true,
        service: "mcp",
        time: new Date().toISOString(),
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(structuredOutput) }],
        structuredOutput,
      };
    },
  );
}

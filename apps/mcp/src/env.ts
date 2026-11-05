/**
 * Environment validation for the MCP server (§5.2: `apps/mcp/src/env.ts`).
 * `DATABASE_URL` is enforced by `@app/db` on import; the rest is validated
 * here to fail fast with an actionable message.
 */
export const MCP_PORT = Number(process.env.MCP_PORT ?? 3001);

export const MCP_SERVER_NAME = "stackgoat-mcp";
export const MCP_SERVER_VERSION = "0.0.1";

export function assertMcpEnv(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not defined. Define a single `.env` at the monorepo " +
        "root (see `.env.example`) or export the variable before running " +
        "`bun run dev` in apps/mcp.",
    );
  }
  if (!Number.isInteger(MCP_PORT) || MCP_PORT <= 0) {
    throw new Error(`Invalid MCP_PORT: ${process.env.MCP_PORT}`);
  }
}

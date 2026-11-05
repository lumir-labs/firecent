import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "../env";
import type { McpAuthContext } from "./auth";
import { registerOrgInfoTool } from "./tools/org-info";
import { registerOrgMembersTool } from "./tools/org-members";
import { registerHealthTool } from "./tools/health";

/**
 * Creates the boilerplate's MCP Server and registers the 3 tools (§5.2 + §5.5).
 * One instance is created per HTTP request with `auth` already resolved, so
 * each tool filters by the key's `orgId` (§5.3 step 6).
 */
export function createMcpServer(auth: McpAuthContext): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });
  registerOrgInfoTool(server, auth);
  registerOrgMembersTool(server, auth);
  registerHealthTool(server);
  return server;
}

/** Server with only the public tool (for unauthenticated proposals, if used). */
export function createPublicMcpServer(): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });
  registerHealthTool(server);
  return server;
}

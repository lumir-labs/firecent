import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import "@app/env"; // carga el .env raíz antes que todo (única fuente)
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { assertMcpEnv, MCP_PORT } from "./env";
import { authenticateMcpRequest } from "./mcp/auth";
import { createMcpServer } from "./mcp/server";

assertMcpEnv();

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return undefined;
  return JSON.parse(raw);
}

async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { success: false, error: "Method not allowed" });
    return;
  }
  // §5.3: per-request auth via org API key; no valid header → 401.
  const auth = await authenticateMcpRequest(req, res);
  if (!auth) return;

  let parsedBody: unknown;
  try {
    parsedBody = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { success: false, error: "Invalid JSON body" });
    return;
  }

  // Stateless (no session): one server instance + transport per request.
  const server = createMcpServer(auth);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    void transport.close().catch(() => undefined);
    void server.close().catch(() => undefined);
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
  } catch (error) {
    console.error("[mcp] error handling request", error);
    if (!res.headersSent) {
      sendJson(res, 500, { success: false, error: "Internal server error" });
    }
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/health" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      service: "mcp",
      time: new Date().toISOString(),
    });
    return;
  }
  if (url.pathname === "/mcp") {
    void handleMcp(req, res).catch((error: unknown) => {
      console.error("[mcp] unhandled error", error);
      if (!res.headersSent) {
        sendJson(res, 500, { success: false, error: "Internal server error" });
      }
    });
    return;
  }
  sendJson(res, 404, { success: false, error: "Not found" });
});

server.listen(MCP_PORT, () => {
  console.log(`[mcp] listening on :${MCP_PORT} (POST /mcp, GET /health)`);
});

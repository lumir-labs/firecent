import assert from "node:assert/strict";
import http from "node:http";
import { describe, test } from "node:test";
import { DEFAULT_KIMI_TIMEOUT_MS, streamKimiCompletion } from "./kimi.ts";

describe("Kimi native HTTP/HTTPS SSE client", () => {
  test("defaults to 10-minute timeout", () => {
    assert.equal(DEFAULT_KIMI_TIMEOUT_MS, 600_000);
  });

  test("streams reasoning, text, tool_calls, and enforces custom timeout", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/slow") {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        // Never ends -> triggers TimeoutError
        return;
      }
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(
        `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "think" } }] })}\n\n`,
      );
      res.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: "Hola" } }] })}\n\n`,
      );
      res.write(
        `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "list_unmatched_transfers", arguments: "{}" } }] } }] })}\n\n`,
      );
      res.write(
        `data: ${JSON.stringify({ choices: [{ finish_reason: "tool_calls", delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } })}\n\n`,
      );
      res.write("data: [DONE]\n\n");
      res.end();
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;

    const prevKey = process.env.NVIDIA_API_KEY;
    const prevUrl = process.env.NVIDIA_API_URL;
    process.env.NVIDIA_API_KEY = "test-key";

    try {
      process.env.NVIDIA_API_URL = `http://127.0.0.1:${port}/fast`;
      const result = await streamKimiCompletion({
        messages: [{ role: "user", content: "hi" }],
        timeoutMs: 5_000,
      });
      assert.equal(result.reasoningContent, "think");
      assert.equal(result.content, "Hola");
      assert.equal(result.toolCalls.length, 1);
      assert.equal(result.toolCalls[0]?.function.name, "list_unmatched_transfers");
      assert.equal(result.usage.totalTokens, 15);

      process.env.NVIDIA_API_URL = `http://127.0.0.1:${port}/slow`;
      await assert.rejects(
        () =>
          streamKimiCompletion({
            messages: [{ role: "user", content: "slow" }],
            timeoutMs: 120,
          }),
        (err) => err instanceof Error && err.name === "TimeoutError",
      );
    } finally {
      if (prevKey === undefined) delete process.env.NVIDIA_API_KEY;
      else process.env.NVIDIA_API_KEY = prevKey;
      if (prevUrl === undefined) delete process.env.NVIDIA_API_URL;
      else process.env.NVIDIA_API_URL = prevUrl;
      server.close();
    }
  });
});

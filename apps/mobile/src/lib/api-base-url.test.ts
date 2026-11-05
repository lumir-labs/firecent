import { describe, expect, test } from "bun:test";
import { resolveApiBaseUrl } from "./api-base-url";

describe("resolveApiBaseUrl", () => {
  test("uses the env when defined (trims spaces)", () => {
    expect(resolveApiBaseUrl("http://192.168.1.10:3000 ")).toBe(
      "http://192.168.1.10:3000",
    );
  });

  test("without env → localhost (never a hardcoded IP)", () => {
    expect(resolveApiBaseUrl(undefined)).toBe("http://localhost:3000");
    expect(resolveApiBaseUrl("  ")).toBe("http://localhost:3000");
  });
});

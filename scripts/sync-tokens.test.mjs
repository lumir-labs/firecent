import assert from "node:assert";

// RED premise: a Windows (CRLF) checkout must be considered in sync if it only differs in \r.
// Without normalizing, the exact comparison fails even though the semantic content is equal.
const lf = "a\nb\n";
const crlf = "a\r\nb\r\n";

assert.notStrictEqual(crlf, lf, "premise: CRLF !== LF without normalizing (the bug exists)");
assert.strictEqual(
  crlf.replace(/\r\n/g, "\n"),
  lf,
  "normalizeLF must equate CRLF with LF",
);

console.log("sync-tokens CRLF premise OK");

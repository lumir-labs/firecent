import assert from "node:assert/strict";
import { test } from "node:test";
import { logMailToConsole } from "./email.ts";

test("doesn't print anything in production (no magic-link leak)", () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  let logged = "";
  const orig = console.log;
  console.log = (...a) => {
    logged += a.join(" ");
  };
  try {
    logMailToConsole({
      to: "a@x.com",
      subject: "s",
      text: "https://x/magic?token=SECRET",
    });
  } finally {
    console.log = orig;
    process.env.NODE_ENV = prev;
  }
  assert.equal(logged, "");
});

test("in development it does print (local DX)", () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  let logged = "";
  const orig = console.log;
  console.log = (...a) => {
    logged += a.join(" ");
  };
  try {
    logMailToConsole({ to: "a@x.com", subject: "s", text: "hello" });
  } finally {
    console.log = orig;
    process.env.NODE_ENV = prev;
  }
  assert.ok(logged.includes("MAIL"));
});

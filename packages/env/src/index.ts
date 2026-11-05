// Canonical monorepo environment loader (@app/env).
// Single source: the `.env` at the monorepo ROOT (production injects
// variables directly and no file ever overrides them). Dev fallbacks that do
// NOT override the root: apps/web/.env.local and packages/db/.env.
//
// Rules:
// - `process.loadEnvFile` does NOT overwrite already-defined variables: hosting wins.
// - Idempotent: safe to call from multiple workspaces with no double effect.
// - This package imports nothing from @app/* (it runs before everything else).

import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // .../packages/env/src
const ROOT_ENV = path.resolve(HERE, "..", "..", "..", ".env");
const WEB_LOCAL = path.resolve(HERE, "..", "..", "..", "apps", "web", ".env.local");
const DB_LOCAL = path.resolve(HERE, "..", "..", "..", "packages", "db", ".env");

let loaded = false;

/** Loads the root `.env` (+ dev fallbacks). Safe to call repeatedly. */
export function loadRootEnv(): void {
  if (loaded) return;
  loaded = true;

  for (const file of [ROOT_ENV, WEB_LOCAL, DB_LOCAL]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Missing file: expected in production (hosting injects variables).
    }
  }
}

loadRootEnv();

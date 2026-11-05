#!/usr/bin/env node
/**
 * Single source of truth for i18n messages: `packages/lib/src/messages/{es,en}.json`.
 *
 * The web needs a copy in `apps/web/messages/` because TypeScript cannot
 * load next-intl's `.d.json.ts` typings (`createMessagesDeclaration`)
 * from outside the workspace without global `allowArbitraryExtensions`.
 *
 * Usage:
 *   bun run i18n:sync           copies packages → apps/web/messages
 *   bun run i18n:sync --check   verify only (exit 1 on drift)
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(root, "packages", "lib", "src", "messages");
const TARGET_DIR = join(root, "apps", "web", "messages");

const checkOnly = process.argv.includes("--check");
const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".json"));

let drift = false;

for (const file of files) {
  const source = readFileSync(join(SOURCE_DIR, file), "utf8");
  const targetPath = join(TARGET_DIR, file);

  let target = null;
  try {
    target = readFileSync(targetPath, "utf8");
  } catch {
    // The web copy does not exist yet.
  }

  if (target === source) {
    console.log(`✓ ${file} in sync`);
    continue;
  }

  drift = true;
  if (checkOnly) {
    console.error(`✗ ${file} is out of sync with packages/lib/src/messages/${file}`);
  } else {
    writeFileSync(targetPath, source, "utf8");
    console.log(`↻ ${file} → apps/web/messages/${file}`);
  }
}

if (drift && checkOnly) {
  console.error(
    "\nEdit packages/lib/src/messages/*.json (single source) and run `bun run i18n:sync`.\n",
  );
  process.exit(1);
}

if (!drift) console.log("✓ Messages in sync with the packages single source");

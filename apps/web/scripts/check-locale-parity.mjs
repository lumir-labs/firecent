import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Shared single source: packages/lib/src/messages is the source of truth;
// apps/web/messages is its synced copy (verified by the single-source check below).
const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = join(__dirname, "..", "messages");
const REFERENCE = "es.json";

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? flatten(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

const files = readdirSync(MESSAGES_DIR).filter((f) => f.endsWith(".json"));
const reference = flatten(
  JSON.parse(readFileSync(join(MESSAGES_DIR, REFERENCE), "utf8")),
);
const referenceSet = new Set(reference);

let failed = false;

for (const file of files) {
  if (file === REFERENCE) continue;
  const keys = flatten(JSON.parse(readFileSync(join(MESSAGES_DIR, file), "utf8")));
  const keysSet = new Set(keys);

  const missing = reference.filter((k) => !keysSet.has(k));
  const extra = keys.filter((k) => !referenceSet.has(k));

  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n✗ ${file}`);
    missing.forEach((k) => console.error(`  MISSING: ${k}`));
    extra.forEach((k) => console.error(`  EXTRA:   ${k}`));
  }
}

if (failed) {
  console.error("\nLocale check failed. Fix the issues above.\n");
  process.exit(1);
}

// ── Message single source ────────────────────────────────────────────────
// `packages/lib/src/messages/*.json` is the source of truth (used by mobile and
// web via `bun run i18n:sync`). If they diverge, run that command from the root.
const SOURCE_DIR = join(__dirname, "..", "..", "..", "packages", "lib", "src", "messages");

for (const file of files) {
  let source;
  try {
    source = readFileSync(join(SOURCE_DIR, file), "utf8");
  } catch {
    continue; // locale without a packages equivalent
  }

  if (source !== readFileSync(join(MESSAGES_DIR, file), "utf8")) {
    failed = true;
    console.error(`\n✗ ${file} out of sync with packages/lib/src/messages/${file}`);
    console.error("  Run `bun run i18n:sync` from the monorepo root.");
  }
}

if (failed) {
  console.error("\nLocale check failed. Fix the issues above.\n");
  process.exit(1);
}
console.log("✓ Locale parity + single source OK");

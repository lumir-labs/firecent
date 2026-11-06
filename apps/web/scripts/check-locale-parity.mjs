import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Single source shared by web and mobile: packages/lib/src/messages.
const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = join(__dirname, "..", "..", "..", "packages", "lib", "src", "messages");
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

console.log("✓ Locale parity OK");

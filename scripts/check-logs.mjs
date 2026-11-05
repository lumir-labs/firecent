import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
let failed = false;
const fail = (m) => {
  failed = true;
  console.error(`✗ ${m}`);
};

const DIRS = [
  "apps/web/lib/actions",
  "apps/web/services",
  "apps/web/components",
  "apps/web/app",
];
// console.log/error that serializes a sensitive variable (not static strings).
const BAD = [
  /console\.log\(\s*["'`][^"'`]*$/,
  /console\.log\([^)]*\b(roleName|session|token|secret|password|orgId)\b[^)]*\)/,
  /console\.log\(\s*transformedData\s*\)/,
  /console\.log\(\s*selectedDateTime\s*\)/,
  /JSON\.stringify\([^)]*session[^)]*\)/,
  /console\.log\([^)]*\bto\b[^)]*,\s*subject/,
];

function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(p) || p.endsWith(".test.mjs")) continue;
    const src = readFileSync(p, "utf8");
    src.split("\n").forEach((line, i) => {
      if (line.includes("no-pii-check-skip")) return;
      for (const re of BAD) {
        if (re.test(line)) {
          fail(`${p.replace(root + "/", "")}:${i + 1} possible PII in log: ${line.trim().slice(0, 100)}`);
          break;
        }
      }
    });
  }
}

for (const d of DIRS) walk(join(root, d));

if (failed) process.exit(1);
console.log("✓ Logs without evident PII OK");

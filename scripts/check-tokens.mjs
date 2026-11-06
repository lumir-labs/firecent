// Guard (NOT a generator): packages/lib/src/tokens/tokens.css must define the
// SAME set of vars in `@variant light` and `@variant dark`.
//
// Uniwind requires it, but `uniwind generate-artifacts` only logs
// "All themes must have the same variables" and still exits 0, so drift
// would slip through CI. On the web a missing dark var silently keeps the
// light value. Runs in apps/mobile `typecheck` (and therefore in CI).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages/lib/src/tokens/tokens.css",
);
const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const varsOf = (variant) => {
  const start = css.indexOf(`@variant ${variant} {`);
  if (start === -1) throw new Error(`@variant ${variant} not found in tokens.css`);
  let depth = 0;
  let end = start;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  return new Set(
    [...css.slice(start, end).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]),
  );
};

const light = varsOf("light");
const dark = varsOf("dark");
const missing = (a, b) => [...a].filter((name) => !b.has(name));
const missingInDark = missing(light, dark);
const missingInLight = missing(dark, light);

if (missingInDark.length || missingInLight.length) {
  console.error("✗ tokens.css: light and dark must define the same vars.");
  if (missingInDark.length) console.error(`  Missing in dark:  ${missingInDark.join(", ")}`);
  if (missingInLight.length) console.error(`  Missing in light: ${missingInLight.join(", ")}`);
  process.exit(1);
}

console.log(`✓ tokens.css: light/dark parity (${light.size} vars)`);

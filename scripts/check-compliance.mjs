import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
let failed = false;
const fail = (m) => {
  failed = true;
  console.error(`✗ ${m}`);
};

// 1. privacy/terms pages exist
for (const p of [
  "apps/web/app/[locale]/privacy/page.tsx",
  "apps/web/app/[locale]/terms/page.tsx",
]) {
  if (!existsSync(join(root, p))) fail(`missing ${p}`);
}
// 2. Public routes listed in routes
const routes = readFileSync(join(root, "apps/web/routes.ts"), "utf8");
for (const r of ["/privacy", "/terms"]) {
  if (!routes.includes(r)) fail(`routes.ts does not include ${r} in publicRoutes`);
}
// 3. Headers in next.config
const nc = readFileSync(join(root, "apps/web/next.config.ts"), "utf8");
for (const h of ["Content-Security-Policy", "Strict-Transport-Security", "X-Frame-Options", "Referrer-Policy"]) {
  if (!nc.includes(h)) fail(`next.config.ts missing header ${h}`);
}
// 4. Disclaimer in README
const readme = readFileSync(join(root, "README.md"), "utf8");
if (!/TAL CUAL|AS-IS/.test(readme)) fail("README missing AS-IS disclaimer");
if (!/not legal advice|no constituye asesoramiento/i.test(readme + readFileSync(join(root, "docs/README.md"), "utf8"))) {
  fail("missing no-legal-advice notice");
}
// 5. DSR stubs exist
if (!existsSync(join(root, "apps/web/lib/actions/account.ts"))) {
  fail("missing apps/web/lib/actions/account.ts (DSR stubs)");
}

if (failed) process.exit(1);
console.log("✓ Compliance baseline OK");

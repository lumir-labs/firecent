import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
let failed = false;
const fail = (m) => {
  failed = true;
  console.error(`✗ ${m}`);
};
const read = (p) => readFileSync(join(root, p), "utf8");

// 1. No links to /portal/overview (nonexistent route)
for (const f of [
  "apps/web/app/[locale]/(protected)/(home)/_components/header.tsx",
  "apps/web/app/[locale]/(protected)/admin/_components/header.tsx",
  "apps/web/app/[locale]/(protected)/(home)/_components/user-sidebar.tsx",
]) {
  try {
    if (read(f).includes("/portal/overview")) fail(`${f} links to /portal/overview`);
  } catch {}
}
// 2. No <a href="#"> in login/reset
for (const f of [
  "apps/web/app/[locale]/(auth)/auth/login/page.tsx",
  "apps/web/app/[locale]/(auth)/auth/reset/page.tsx",
]) {
  try {
    if (read(f).includes('href="#"')) fail(`${f} uses href="#"`);
  } catch {}
}
// 3. Navbar/footer without hardcoded "App" as the logo (single line or multiline)
for (const f of [
  "apps/web/app/[locale]/landing/_components/landing-navbar.tsx",
  "apps/web/app/[locale]/landing/_components/landing-footer.tsx",
]) {
  try {
    const src = read(f);
    if (/>App</.test(src) || /^\s*App\s*$/m.test(src)) fail(`${f} hardcodes App`);
  } catch {}
}
// 4. routes.ts without a ghost /auth/register
try {
  if (read("apps/web/routes.ts").includes("/auth/register")) {
    fail(`apps/web/routes.ts declares /auth/register without a page`);
  }
} catch {}
// 5. landing metadata localized (no hardcoded title in any language)
try {
  const lp = read("apps/web/app/[locale]/landing/page.tsx");
  if (/Esta podría ser tu SaaS|genérica de demostración|This could be your SaaS|generic demonstration landing/i.test(lp)) {
    fail(`landing/page.tsx metadata hardcoded instead of i18n`);
  }
} catch {}

if (failed) process.exit(1);
console.log("✓ UI ropes OK");

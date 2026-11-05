// Verifies the environment has the minimum needed to boot, WITHOUT printing secrets.
// Local use:  node scripts/check-env.mjs
// Hosted use: node scripts/check-env.mjs --strict (fails if SMTP is missing in prod)
// Reads `<root>/.env` as a fallback without overriding the hosting environment.
import path from "node:path";

for (const p of [
  path.resolve(import.meta.dirname ?? ".", "..", ".env"),
  // Local fallback: if there is no root `.env`, check the development ones.
  path.resolve(import.meta.dirname ?? ".", "..", "apps", "web", ".env"),
  path.resolve(import.meta.dirname ?? ".", "..", "apps", "web", ".env.local"),
  path.resolve(import.meta.dirname ?? ".", "..", "packages", "db", ".env"),
]) {
  try {
    process.loadEnvFile(p);
  } catch {
    // No file: ok if the hosting injects variables directly.
  }
}

const REQUIRED = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "NEXT_PUBLIC_APP_NAME",
];

const RECOMMENDED_PROD = ["SMTP_HOST", "EMAIL_FROM"];

const strict = process.argv.includes("--strict");
const missing = REQUIRED.filter((k) => !process.env[k]);

// Secrets with an obvious placeholder = treat as missing.
for (const k of ["BETTER_AUTH_SECRET"]) {
  const v = process.env[k] ?? "";
  if (v.includes("cambia-esto")) missing.push(`${k} (still has the example value)`);
}

if (missing.length) {
  console.error(`[env] MISSING ${missing.length} required variables:`);
  for (const k of missing) console.error(`  - ${k}`);
  console.error("Copy `.env.example` to `.env` at the root, or inject the variables in your hosting.");
  process.exit(1);
}

if (strict) {
  const warn = RECOMMENDED_PROD.filter((k) => !process.env[k]);
  if (warn.length) {
    console.error(`[env] In production it is recommended to define: ${warn.join(", ")}`);
    process.exit(1);
  }
}

// Security: alert if a secret ended up marked as public.
const leaked = ["DATABASE_URL", "BETTER_AUTH_SECRET", "SMTP_PASSWORD", "GOOGLE_CLIENT_SECRET"].filter(
  (k) => process.env[`NEXT_PUBLIC_${k}`],
);
if (leaked.length) {
  console.error(`[env] VULNERABILITY: these secrets have the NEXT_PUBLIC_ prefix (they ship to the browser): ${leaked.join(", ")}`);
  process.exit(1);
}

console.log("[env] OK: required variables present.");

import { defineConfig, env } from "prisma/config";
import path from "node:path";

// Canonical source: a single `.env` at the monorepo root (for hosting).
// Local fallback: `packages/db/.env` (development only).
// `process.loadEnvFile` never overwrites already-defined variables: hosting
// values always win. Order: root first, local file only fills gaps.
for (const p of [
  path.resolve(import.meta.dirname ?? ".", "..", "..", ".env"),
  path.resolve(import.meta.dirname ?? ".", ".env"),
]) {
  try {
    process.loadEnvFile(p);
  } catch {
    // Missing file: expected on hosts that inject env directly.
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

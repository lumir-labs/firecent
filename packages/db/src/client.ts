import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/client/client";
import "@app/env"; // carga el .env raíz (única fuente) si nadie lo hizo aún

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not defined. Define a single `.env` at the monorepo " +
      "root (see `.env.example`) or inject the variable in your hosting. " +
      "In development, `apps/web/.env.local` or `packages/db/.env` also work.",
  );
}

const globalForPrisma = globalThis as unknown as {
  __firecentDb?: PrismaClient;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Keep a single warm connection pool across Next.js dev HMR reloads
// (huge win when Postgres is reached over an SSH tunnel or remote host).
const db = globalForPrisma.__firecentDb ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__firecentDb = db;
}

export { db };

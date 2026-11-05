// Replaces a nativewind-env.d.ts: Uniwind generates its own types
// (uniwind-types.d.ts) via `bun run artifacts` in apps/mobile.
// This file only declares the import of *.css for TypeScript.
declare module "*.css";

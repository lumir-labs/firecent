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

// 1. AGENTS links exist (relative to apps/web/)
const agents = readFileSync(join(root, "apps/web/AGENTS.md"), "utf8");
const candidates = [...agents.matchAll(/(?:docs\/|standards\/)[\w./-]+\.md/g)].map(
  (m) => m[0],
);
for (const c of new Set(candidates)) {
  const abs = join(root, "apps/web", c);
  const absRootDocs = join(root, c);
  if (!existsSync(abs) && !existsSync(absRootDocs)) {
    fail(`apps/web/AGENTS.md points to a nonexistent file: ${c}`);
  }
}
// 2. TRPC example uses a real permission
const perms = readFileSync(
  join(root, "packages/api/src/permissions.ts"),
  "utf8",
);
const trpc = readFileSync(join(root, "docs/TRPC.md"), "utf8");
for (const m of trpc.matchAll(/p\.(\w+)\.(\w+)/g)) {
  const [, cat, key] = m;
  if (cat === "users" && key === "list" && !perms.includes('"users:list"')) {
    fail(`docs/TRPC.md uses p.users.list which does not exist in permissions.ts`);
    break;
  }
}
// 3. COMPONENTS does not say "copy 6 files" (there are 7 in users/_components)
const comp = readFileSync(join(root, "docs/COMPONENTS.md"), "utf8");
if (/copy (the )?6 files|copia los 6 archivos/.test(comp)) {
  fail(`docs/COMPONENTS.md says "copy 6 files" (there are 7)`);
}
// 4. MCP scopes document deny-by-default
const mcp = readFileSync(join(root, "docs/MCP.md"), "utf8");
if (/scopes[^\n]*=\s*all|vacío = todos/i.test(mcp)) {
  fail(`docs/MCP.md still documents fail-open (empty=all)`);
}

if (failed) {
  process.exit(1);
}
console.log("✓ Docs boilerplate OK");

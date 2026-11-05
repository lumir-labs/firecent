// Generates docs/ARCHITECTURE.md from the code (§6.3).
// Deterministic: no timestamps, no randomness; everything sorted. Plain node (no deps).
// Usage: node scripts/gen-architecture.mjs  (or `bun run docs:gen` from the root)
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "docs", "ARCHITECTURE.md");

const hashParts = [];
function track(rel, content) {
  hashParts.push(`--- ${rel} ---\n${content}`);
}
function read(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  const c = readFileSync(p, "utf8").replace(/\r\n?/g, "\n");
  track(rel, c);
  return c;
}
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function readJson(rel) {
  const c = read(rel);
  return c ? JSON.parse(c) : null;
}
function* walk(dir, ext) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    compare(a.name, b.name),
  );
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p, ext);
    else if (ext.some((x) => e.name.endsWith(x))) yield p;
  }
}
const rel = (p) => relative(ROOT, p).replaceAll("\\", "/");

// --- 1. Workspaces ---------------------------------------------------------
const rootPkg = readJson("package.json") ?? {};
const workspaces = [];
for (const dir of ["apps", "packages"]) {
  const base = join(ROOT, dir);
  if (!existsSync(base)) continue;
  for (const name of readdirSync(base).sort()) {
    const pkg = readJson(`${dir}/${name}/package.json`);
    if (!pkg) continue;
    workspaces.push({
      dir: `${dir}/${name}`,
      name: pkg.name ?? name,
      scripts: Object.keys(pkg.scripts ?? {}).sort(),
    });
  }
}

// --- 2. Web routes -----------------------------------------------------------
function webRoute(file) {
  // apps/web/app/[locale]/(portal)/api-keys/page.tsx -> /:locale/api-keys
  let r = rel(file).replace(/^apps\/web\/app\//, "").replace(/\/page\.tsx$/, "");
  r = r
    .split("/")
    .filter((s) => !/^\(.*\)$/.test(s))
    .map((s) => (s === "[locale]" ? ":locale" : s.replace(/^\[(.+)\]$/, ":$1")))
    .join("/");
  return "/" + r;
}
const webRoutes = [];
{
  const base = join(ROOT, "apps/web/app");
  if (existsSync(base)) for (const f of walk(base, ["page.tsx"])) webRoutes.push(webRoute(f));
  webRoutes.sort();
}

// --- 3. tRPC ----------------------------------------------------------------
const trpcRouters = [];
{
  const base = join(ROOT, "packages/api/src/routers");
  if (existsSync(base)) {
    for (const f of walk(base, [".ts"])) {
      const src = read(rel(f));
      const procs = [...src.matchAll(/(\w+)\s*:\s*(public|protected)Procedure[^;]*?\.(query|mutation)\b/gs)].map(
        (m) => `${m[1]} (${m[2]}, ${m[3]})`,
      );
      trpcRouters.push({ file: rel(f), procedures: procs.sort() });
    }
  }
  trpcRouters.sort((a, b) => compare(a.file, b.file));
  const rootSrc = read("packages/api/src/root.ts") ?? "";
  const mounted = [...rootSrc.matchAll(/^\s*(\w+)\s*:\s*(?:\w*Router|protectedProcedure|publicProcedure)/gm)].map((m) => m[1]).sort();
  trpcRouters.mounted = mounted;
}

// --- 4. Permissions --------------------------------------------------------------
const permissions = [];
{
  const src = read("packages/api/src/permissions.ts") ?? "";
  for (const m of src.matchAll(/def\(\s*"([^"]+)"/g)) permissions.push(m[1]);
  permissions.sort();
}

// --- 5. Prisma -----------------------------------------------------------------
const models = [];
{
  const src = read("packages/db/prisma/schema.prisma") ?? "";
  for (const m of src.matchAll(/^model (\w+) \{([^}]*)\}/gm)) {
    const fields = m[2]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))
      .map((l) => l.split(/\s+/).slice(0, 2).join(" "));
    models.push({ name: m[1], fields });
  }
  models.sort((a, b) => compare(a.name, b.name));
}

// --- 6. i18n ---------------------------------------------------------------------
let namespaces = [];
{
  const es = readJson("packages/lib/src/messages/es.json") ?? readJson("apps/web/messages/es.json") ?? {};
  namespaces = Object.keys(es).sort();
}

// --- 7. Guards --------------------------------------------------------------------
let guards = { publicRoutes: [], authRoutes: [], apiAuthPrefix: "", apiBypasses: [] };
{
  const src = read("apps/web/routes.ts") ?? "";
  const arr = (n) => [...(src.match(new RegExp(`${n}\\s*=\\s*\\[([^\\]]*)`))?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  guards.publicRoutes = arr("publicRoutes");
  guards.authRoutes = arr("authRoutes");
  guards.apiAuthPrefix = /apiAuthPrefix\s*=\s*"([^"]+)"/.exec(src)?.[1] ?? "";
  const proxy = read("apps/web/proxy.ts") ?? "";
  guards.apiBypasses = [...proxy.matchAll(/pathname\.startsWith\("([^"]+)"\)/g)]
    .map((m) => m[1])
    .filter((v, i, a) => v.startsWith("/api") && a.indexOf(v) === i)
    .sort();
}

// --- 8. Mobile app dir ---------------------------------------------------------------
const mobileRoutes = [];
{
  const base = join(ROOT, "apps/mobile/src/app");
  if (existsSync(base)) {
    for (const f of walk(base, [".tsx", ".ts"])) {
      // Non-route siblings (style files, layouts, tests) are not routes.
      const leaf = rel(f).split("/").pop() ?? "";
      if (
        leaf.includes(".styles.") ||
        leaf.startsWith("_layout") ||
        leaf.includes(".test.") ||
        leaf.includes(".spec.")
      ) {
        continue;
      }
      let r = rel(f)
        .replace(/^apps\/mobile\/src\/app\//, "")
        .replace(/\.(tsx|ts)$/, "")
        .replace(/\/index$/, "")
        .replace(/^index$/, "/");
      mobileRoutes.push(r === "/" ? "/" : `/${r}`);
    }
    mobileRoutes.sort();
  }
}

const inputsHash = createHash("sha256").update(hashParts.join("\n")).digest("hex").slice(0, 16);

const sec = (t, body) => `## ${t}\n\n${body}\n`;
const lines = [];
lines.push(`<!-- GENERATED by scripts/gen-architecture.mjs — do not edit by hand -->`);
lines.push(`# ARCHITECTURE (generated)`);
lines.push(``);
lines.push(`> inputs-hash: \`${inputsHash}\` — changes if any scanned input changes.`);
lines.push(`> Regenerate with \`bun run docs:gen\`.`);
lines.push(``);
lines.push(sec("Workspaces", workspaces.map((w) => `- \`${w.dir}\` (${w.name}) — scripts: ${w.scripts.join(", ") || "—"}`).join("\n")));
lines.push(sec("Web routes (`apps/web`)", webRoutes.map((r) => `- \`${r}\``).join("\n") || "—"));
lines.push(
  sec(
    "tRPC API (`packages/api`)",
    `Mounted in \`root.ts\`: ${trpcRouters.mounted.join(", ") || "—"}\n\n` +
      trpcRouters.map((r) => `- \`${r.file}\`: ${r.procedures.join(", ") || "no procedures"}`).join("\n"),
  ),
);
lines.push(sec("Permissions (`permissions.ts`)", permissions.map((k) => `- \`${k}\``).join("\n") || "—"));
lines.push(
  sec(
    "Prisma models (`packages/db`)",
    models.map((m) => `- \`${m.name}\`: ${m.fields.join(", ")}`).join("\n") || "—",
  ),
);
lines.push(sec("i18n (namespaces)", namespaces.map((n) => `- \`${n}\``).join("\n") || "—"));
lines.push(
  sec(
    "Guards (`proxy.ts` + `routes.ts`)",
    `- publicRoutes: ${guards.publicRoutes.map((r) => `\`${r}\``).join(", ") || "—"}\n` +
      `- authRoutes: ${guards.authRoutes.map((r) => `\`${r}\``).join(", ") || "—"}\n` +
      `- apiAuthPrefix: \`${guards.apiAuthPrefix}\`\n` +
      `- /api bypasses (no cookie): ${guards.apiBypasses.map((r) => `\`${r}\``).join(", ") || "—"}`,
  ),
);
lines.push(sec("Mobile (`apps/mobile/src/app`)", mobileRoutes.map((r) => `- \`${r}\``).join("\n") || "—"));

writeFileSync(OUT, `${lines.join("\n")}\n`);
console.log(`docs/ARCHITECTURE.md generated (inputs-hash ${inputsHash})`);

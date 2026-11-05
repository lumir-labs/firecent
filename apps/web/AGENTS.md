# Agent Instructions

## Documentation Review

Before starting any task, review the project documentation in the root **docs/** directory:

- `docs/README.md` — index and 30-second map of the boilerplate
- `docs/CONVENTIONS.md` — i18n, folder layout, client/server boundaries, `proxy.ts`
- `docs/TRPC.md` — tRPC setup and the add-a-procedure recipe
- `docs/MCP.md` — MCP server, org API keys, add-a-tool recipe
- `docs/COMPONENTS.md` — reusable UI catalog (web + mobile)
- `docs/USER-GUIDE.md` — human-facing walkthrough of the product

## Documentation Updates

When you have **completely finished** a task, briefly update the relevant documentation:

- `docs/ARCHITECTURE.md` — regenerate with `bun run docs:gen` (never edit by hand) after route/schema/API changes
- `docs/CONVENTIONS.md` — if new conventions were established
- `docs/README.md` — if the map changed

Keep updates concise and focused on what was actually changed.

## Branch and Commit Rules

- **Never** commit or push to `main`. Create a new branch for each task.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, etc.).
- Make small, descriptive commits.
- Do not merge your own PRs. Leave everything ready for review.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

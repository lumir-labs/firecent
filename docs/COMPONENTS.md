# Reusable components

> Last verified: 2026-10-12 against `feat/teams-dsr-2fa`.

## Web: `apps/web/components/ui/*` (shadcn, ~50 primitives)

`accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb, button-group,
button, calendar, card, carousel, chart, checkbox, collapsible, combobox, command,
context-menu, dialog, direction, drawer, dropdown-menu, empty, field, hover-card,
input-group, input-otp, input, item, kbd, label, menubar, native-select, navigation-menu,
pagination, popover, progress, radio-group, resizable, scroll-area, select, separator,
sheet, sidebar, skeleton, slider, sonner, spinner, switch, table, tabs, textarea,
toggle-group, toggle, tooltip`.

Rule: if the primitive exists, use it. Do not build a custom `Modal`/`Table`.

```tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
```

## Web: `apps/web/components/base/*` (custom, when to use each)

| Component | Use |
|---|---|
| `base-autocomplete.tsx` | searchable select (e.g. assigning role/org) |
| `base-create.tsx` | generic creation dialog (see `admin/permissions/_components/create.tsx`) |
| `base-data-table-row-actions.tsx` | per-row ⋯ menu (edit/delete) |
| `base-dialog-multiselect.tsx` | assign N items (e.g. roles to a user, `users/_components/prop-edit.tsx`) |
| `base-dialog-select.tsx` | pick 1 item in a dialog |

## Web: `apps/web/components/common/*` (selection)

`access-alert.tsx` (denied gate: title + description — use it on every page gated
by `validatePermission`), `theme-switcher.tsx`, `language-switcher.tsx`,
`copy-button.tsx` (to show an API key secret exactly once), `table-skeleton.tsx`,
`data-table-pagination.tsx`, `unauthorized.tsx`, `org-switcher.tsx` (header
organization switcher).

## Web: the copyable admin pattern (DataTable)

Every admin CRUD screen follows the same mold (`users/_components/`,
`permissions/_components/`):

```
data-table.tsx + columns.tsx + data-table-toolbar.tsx + data-table-row-actions.tsx
+ prop-edit.tsx (inline edit) + create.tsx / new-*.tsx (creation)
```

For a new screen: copy the 7 files from `admin/users/_components/`
(`columns.tsx`, `data-table.tsx`, `data-table-toolbar.tsx`,
`data-table-row-actions.tsx`, `prop-edit.tsx`, `users-table.tsx`, `new-role.tsx`),
swap the zod schema and the actions. Checklist: rename the domain imports,
update `useCatalogFn` (roles/orgs), i18n keys `Admin.<domain>.*`,
permission `p.<domain>.*` + sync at `/en/admin/permissions`, and the actions in
`apps/web/lib/actions/<domain>.ts` with `validatePermission`.
Tables use TanStack Table; inline editing via `prop-edit.tsx`.

## Mobile: `apps/mobile/src/components/ui/*`

`badge, button, dialog, drawer, icon, input-group, input, lucide-icon,
safe-area-view, select, separator, tabs, text` (+ `common/`, `home/`, `navigation/`).
**`drawer.tsx` is the canonical** bottom sheet (`sheet.tsx` was removed). Visual
catalog with examples: `apps/mobile/src/app/ui-kit.tsx`.

Web→RN correspondences: `Button→button.tsx`, `Dialog→dialog.tsx`,
`Select→select.tsx`, `Input→input.tsx`, `Tabs→tabs.tsx`, `Badge→badge.tsx`.
There is no `Table` on mobile (honest gap: no `FlatList` example in the repo yet;
use lists + `drawer` for row actions).

Tabs: `(tabs)/_layout.tsx` owns `USE_FLOATING_TAB_BAR` — `true` renders the
floating blur bar (`navigation/floating-tab-bar.tsx`), `false` a normal
theme-aware expo-router bar (icons + labels, no CTA). Charts: victory-native
(Skia edition, see the official XL guide) — example in
`components/home/weekly-chart.tsx` with demo data from `@/lib/demo-week`
(fixed values on purpose, replace with a tRPC query for real metrics).

## Theming (both platforms)

Single source: `packages/lib/src/tokens/tokens.css` — every light/dark value
(shadcn semantic colors + `--brand-*` aliases) in `@layer theme` +
`@variant light` / `@variant dark` form. **No generator**: both apps import
the same file.

- Web (`packages/lib/src/globals.css`): `theme.css` + `shadcn.theme.css` +
  `tokens.css`, and defines what the variants mean on the DOM:
  `@custom-variant dark (&:is(.dark, .dark *))` / `light (&:not(.dark, .dark *))`
  (`.dark` set on `<html>` by next-themes).
- Mobile (`apps/mobile/src/global.css`): same three files; `light` / `dark` are
  Uniwind's built-in themes (do NOT declare `@custom-variant` there).
- Changing a color = edit `tokens.css`. Any var in `@variant light` must also
  exist in `@variant dark` (Uniwind requires it). `scripts/check-tokens.mjs`
  enforces it — a check, not a generator — and runs in mobile `typecheck`, so
  CI catches drift (`uniwind generate-artifacts` only logs it and exits 0).
- Colors in JS (icon `color`, charts, React Navigation, alpha tints): mobile reads
  the resolved values with `useThemeColors()` / `useThemeColor()`
  (`apps/mobile/src/lib/theme-colors.ts`, on top of Uniwind's `useCSSVariable`);
  they re-render on theme change. Add a name to `THEME_COLOR_NAMES` to expose a new one.
- `theme.css` holds the static `--color-brand-*-50…900` palettes.

## Brand assets (logos)

Single source, per-platform copies — same convention as the tokens/i18n syncs:

| File | Role | Status |
|---|---|---|
| `apps/web/public/icon.webp` / `icon_d.webp` | Goat mark (light/dark): sidebars, headers, login | CURRENT brand |
| `apps/web/public/icon.png` | StackGoat favicon: browser tab + apple-touch icon | CURRENT brand |
| `apps/web/public/login-bg.png` | Login/reset side-panel art | CURRENT |
| `apps/mobile/assets/images/logo-mark.png` / `logo-mark-dark.png` | Goat mark for in-app UI (converted from the webp pair) | CURRENT |
| `apps/mobile/assets/images/icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png` | Store/splash icons (old "SG" monogram) | LEGACY — needs the goat master at 1024px+ |
| `apps/web/public/logo_bk.svg` | Unreferenced | DELETED |

Rules:

- `app.json` icon/splash paths must stay LOCAL to `apps/mobile` (Expo
  requirement) — never point them outside the app dir. A shared runtime
  folder for both apps is not possible; share the masters, generate the copies.
- The goat only exists as 207px raster: crisp in-app up to ~200px, NOT usable
  for store icons. When you have the vector/SVG master, add `packages/brand/`
  + `bun run brand:sync` (sharp) to regenerate every target.
- App name lives in two places: `NEXT_PUBLIC_APP_NAME` (web) and
  `expoConfig.name` in `app.json` (mobile, read at runtime — never hardcoded
  in components).

/**
 * SINGLE SOURCE OF TRUTH for the shadcn semantic tokens (theme colors).
 *
 * Generated from here:
 *   - shadcn.light.css        (generated:  `bun run tokens:sync`)
 *   - shadcn.dark.web.css     (generated:  `.dark`, next-themes)
 *   - shadcn.dark.native.css  (generated:  `@media prefers-color-scheme`)
 *   - apps/mobile/src/lib/navigation-theme.ts (imports this module DIRECTLY,
 *     so mobile cannot drift: it is a compilation guarantee)
 *
 * Anti-drift guards:
 *   - `bun run tokens:sync`            regenerates the CSS
 *   - `bun run tokens:sync -- --check` verify only (fails the web build
 *     and mobile's typecheck if any CSS is out of date)
 *
 * Do NOT edit the generated .css files by hand: they get overwritten.
 * The utility→variable mapping (bg-background → var(--background)) lives in
 * shadcn.theme.css, which is structure, not values.
 */

export const semanticTokens = {
  light: {
    background: "#f8fafc",
    foreground: "#0b1220",
    card: "#ffffff",
    "card-foreground": "#0b1220",
    popover: "#ffffff",
    "popover-foreground": "#0b1220",
    primary: "#5e54f0",
    "primary-foreground": "#ffffff",
    secondary: "#f1f4f9",
    "secondary-foreground": "#1f2937",
    muted: "#f4f6fa",
    "muted-foreground": "#64748b",
    accent: "#f1f4f9",
    "accent-foreground": "#0b1220",
    destructive: "#ef4444",
    "destructive-foreground": "#ffffff",
    border: "#e2e8f0",
    input: "#e2e8f0",
    ring: "#7c5cff",
    "chart-1": "#5e54f0",
    "chart-2": "#ff6b3d",
    "chart-3": "#a78bfa",
    "chart-4": "#ffa64f",
    "chart-5": "#3a2edb",
    sidebar: "#ffffff",
    "sidebar-foreground": "#0b1220",
    "sidebar-primary": "#5e54f0",
    "sidebar-primary-foreground": "#ffffff",
    "sidebar-accent": "#ffffff",
    "sidebar-accent-foreground": "#0b1220",
    "sidebar-border": "#e2e8f0",
    "sidebar-ring": "#7c5cff",
  },
  dark: {
    background: "#0b1220",
    foreground: "#f4f6fa",
    card: "#11192a",
    "card-foreground": "#f4f6fa",
    popover: "#11192a",
    "popover-foreground": "#f4f6fa",
    primary: "#7c5cff",
    "primary-foreground": "#ffffff",
    secondary: "#182236",
    "secondary-foreground": "#e2e8f0",
    muted: "#131b2e",
    "muted-foreground": "#94a3b8",
    accent: "#182236",
    "accent-foreground": "#f4f6fa",
    destructive: "#ef4444",
    "destructive-foreground": "#ffffff",
    border: "#1e293b",
    input: "#1e293b",
    ring: "#a78bfa",
    "chart-1": "#9a88fb",
    "chart-2": "#ff7a3d",
    "chart-3": "#ffa64f",
    "chart-4": "#a78bfa",
    "chart-5": "#5e54f0",
    sidebar: "#080e1a",
    "sidebar-foreground": "#e2e8f0",
    "sidebar-primary": "#7c5cff",
    "sidebar-primary-foreground": "#ffffff",
    "sidebar-accent": "#141c2e",
    "sidebar-accent-foreground": "#e2e8f0",
    "sidebar-border": "#1e293b",
    "sidebar-ring": "#a78bfa",
  },
} as const;

export type SemanticTokenName = keyof (typeof semanticTokens)["light"];

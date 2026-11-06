import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Hex color (#rgb or #rrggbb) + alpha (0–1) → 8-digit hex. In native, do
// NOT use `/opacity` modifiers on token colors (`bg-input/30`): Tailwind
// compiles them to `color-mix()` with `var()` and the native runtime cannot
// resolve it (transparent background). This is the JS-computed equivalent.
// Short hex is expanded because the CSS minifier may shorten token values
// read at runtime (`#ffffff` → `#fff`).
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const full = short
    ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
    : hex.slice(0, 7);
  return `${full}${a}`;
}

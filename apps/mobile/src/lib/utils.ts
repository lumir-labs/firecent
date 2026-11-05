import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 6-digit hex + alpha (0–1) → 8-digit hex. In native, do NOT use
// `/opacity` modifiers on token colors (`bg-input/30`): Tailwind
// compiles them to `color-mix()` with `var()` and the native runtime cannot
// resolve it (transparent background). This is the JS-computed equivalent.
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

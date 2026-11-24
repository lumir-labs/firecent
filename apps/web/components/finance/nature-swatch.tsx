import { cn } from "@/lib/utils";

import type { Nature } from "./types";
import { NATURE_BG } from "./utils";

export type NatureSwatchProps = {
  nature: Nature;
  className?: string;
};

/**
 * §3.3 — the 10 px square that marks Owe / Need / Want. Decorative: always
 * pair it with the nature's name in text (color is never the only signal).
 */
export function NatureSwatch({ nature, className }: NatureSwatchProps) {
  return (
    <span
      aria-hidden="true"
      data-nature={nature}
      className={cn("inline-block size-2.5 shrink-0 rounded-[3px]", NATURE_BG[nature], className)}
    />
  );
}

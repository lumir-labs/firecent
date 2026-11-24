import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { Money } from "./money";
import type { Surface } from "./types";
import { HERO_SKELETON } from "./utils";

export type ChangeLineProps = {
  /** Signed change in major units. */
  value: number;
  currency: string;
  /** Already translated context, e.g. "this month". */
  context?: string;
  surface?: Surface;
  className?: string;
};

/**
 * E4 — change under a hero figure: `↗ +$1,312.86 this month`.
 * Up = positive with `trending-up`; down = ink with `trending-down`
 * (losing money is not an error, so no red); zero = muted.
 */
export function ChangeLine({
  value,
  currency,
  context,
  surface = "default",
  className,
}: ChangeLineProps) {
  const hero = surface === "hero";
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  const valueColor =
    value > 0
      ? hero
        ? "text-hero-positive"
        : "text-positive"
      : value < 0
        ? hero
          ? "text-hero-foreground"
          : "text-foreground"
        : hero
          ? "text-hero-muted"
          : "text-muted-foreground";

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-0.5",
        hero ? "mt-1.5 text-[13px]" : "mt-2 text-[14px]",
        className,
      )}
    >
      <span className={cn("inline-flex items-center gap-1 font-medium", valueColor)}>
        <Icon aria-hidden className={hero ? "size-3.5" : "size-4"} />
        <Money value={value} currency={currency} tone="movement" surface={surface} className={valueColor} />
      </span>
      {context && (
        <span className={hero ? "text-hero-muted" : "text-muted-foreground"}>
          {context}
        </span>
      )}
    </p>
  );
}

export function ChangeLineSkeleton({
  surface = "default",
  className,
}: {
  surface?: Surface;
  className?: string;
}) {
  return (
    <Skeleton className={cn("mt-2 h-4 w-44", surface === "hero" && HERO_SKELETON, className)} />
  );
}

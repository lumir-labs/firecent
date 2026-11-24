import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { Money, type MoneyTone } from "./money";
import type { Surface } from "./types";
import { HERO_SKELETON } from "./utils";

export type StatItem = {
  icon?: LucideIcon;
  /** Color for the icon, e.g. `text-positive` (default: inherits the label color). */
  iconClassName?: string;
  label: string;
  value: number;
  currency: string;
  tone?: MoneyTone;
  /** Small line under the figure ("2 deposits", "$70.17 / day"). */
  sub?: ReactNode;
  href?: string;
};

export type StatPairProps = {
  /** Two items (E9). Three are allowed on the hero strip. */
  items: StatItem[];
  surface?: Surface;
  className?: string;
};

const COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

/**
 * E9 — pair of figures. Default: inside a card, `dl grid-cols-2 divide-x`,
 * each cell `p-4` with a 13 px label and a card figure (20 px).
 * `surface="hero"`: the glass tiles of the Home balance card.
 */
export function StatPair({ items, surface = "default", className }: StatPairProps) {
  const hero = surface === "hero";
  const cols = COLS[items.length] ?? "grid-cols-2";

  if (hero) {
    return (
      <dl className={cn("grid gap-2", cols, className)}>
        {items.map((it) => (
          <Cell
            key={it.label}
            href={it.href}
            className={cn(
              "block rounded-xl border border-hero-foreground/10 bg-hero-foreground/5 p-2.5 lg:p-3",
              it.href && "hover:bg-hero-foreground/10",
            )}
          >
            <dt className="flex items-center gap-1 text-[11px] font-medium text-hero-muted">
              {it.icon && <it.icon aria-hidden className={cn("size-3.5", it.iconClassName)} />}
              {it.label}
            </dt>
            <dd className="mt-1">
              <Money
                value={it.value}
                currency={it.currency}
                tone={it.tone}
                surface="hero"
                className="block text-[15px] font-semibold lg:text-[17px]"
              />
              {it.sub && (
                <span className="num block text-[11px] text-hero-muted">{it.sub}</span>
              )}
            </dd>
          </Cell>
        ))}
      </dl>
    );
  }

  return (
    <dl className={cn("grid divide-x", cols, className)}>
      {items.map((it) => (
        <Cell
          key={it.label}
          href={it.href}
          className={cn("block min-w-0 p-4", it.href && "hover:bg-accent/60")}
        >
          <dt className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            {it.icon && <it.icon aria-hidden className={cn("size-4", it.iconClassName)} />}
            <span className="truncate">{it.label}</span>
          </dt>
          <dd className="mt-1">
            <Money value={it.value} currency={it.currency} tone={it.tone} size="card" />
            {it.sub && (
              <span className="num mt-0.5 block text-[12px] text-muted-foreground">
                {it.sub}
              </span>
            )}
          </dd>
        </Cell>
      ))}
    </dl>
  );
}

function Cell({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  // `dl > div` groups are valid HTML; a link wraps the group when clickable.
  return href ? (
    <div>
      <Link href={href} className={className}>
        {children}
      </Link>
    </div>
  ) : (
    <div className={className}>{children}</div>
  );
}

export function StatPairSkeleton({
  count = 2,
  surface = "default",
  className,
}: {
  count?: number;
  surface?: Surface;
  className?: string;
}) {
  if (surface === "hero") {
    return (
      <div className={cn("grid gap-2", COLS[count] ?? "grid-cols-2", className)}>
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} className={cn("h-16 rounded-xl", HERO_SKELETON)} />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("grid divide-x", COLS[count] ?? "grid-cols-2", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2 p-4">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

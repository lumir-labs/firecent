import { Lock, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { Money } from "./money";
import type { Surface } from "./types";
import { HERO_SKELETON } from "./utils";

export type SplitBarProps = {
  /** Shared balance, major units. */
  shared: number;
  /** Only-you balance, major units. */
  onlyYou: number;
  currency: string;
  hrefShared?: string;
  hrefOnlyYou?: string;
  surface?: Surface;
  className?: string;
};

/**
 * E6 — Shared / Only you split. A 4 px two-part bar (decorative: the two
 * figures below carry the data) and two links. Only render it in Spaces with
 * more than one member (SPEC §4.3).
 */
export function SplitBar({
  shared,
  onlyYou,
  currency,
  hrefShared,
  hrefOnlyYou,
  surface = "default",
  className,
}: SplitBarProps) {
  const t = useTranslations("Finance.scope");
  const hero = surface === "hero";
  // Negative sides (a card balance bigger than the cash) count as zero width.
  const a = Math.max(0, shared);
  const b = Math.max(0, onlyYou);
  const total = a + b;
  const pct = total > 0 ? (a / total) * 100 : 50;

  const bar = (
    <div className="flex h-1 gap-0.5" aria-hidden="true">
      {pct > 0 && (
        <span
          className={cn("rounded-full", hero ? "bg-hero-line" : "bg-primary")}
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      )}
      {pct < 100 && (
        <span
          className={cn(
            "flex-1 rounded-full",
            hero ? "bg-hero-foreground/25" : "bg-muted-foreground/55",
          )}
        />
      )}
    </div>
  );

  const sides = [
    { key: "shared", icon: Users, label: t("shared"), value: shared, href: hrefShared },
    { key: "only-you", icon: Lock, label: t("onlyYou"), value: onlyYou, href: hrefOnlyYou },
  ] as const;

  if (hero) {
    return (
      <div className={cn("border-t border-hero-foreground/10 pt-3", className)}>
        {bar}
        <div className="mt-1 flex items-center justify-between gap-4 text-[12px]">
          {sides.map((s, i) => (
            <SideLink
              key={s.key}
              href={s.href}
              className={cn(
                "-my-1 inline-flex min-h-11 items-center gap-1.5 text-hero-muted",
                s.href && "hover:text-hero-foreground",
                i === 1 && "text-right",
              )}
            >
              <s.icon
                aria-hidden
                className={cn(i === 0 ? "size-3.5 text-hero-accent" : "size-3")}
              />
              <span>
                {s.label}{" "}
                <Money
                  value={s.value}
                  currency={currency}
                  surface="hero"
                  className="font-semibold text-hero-foreground"
                />
              </span>
            </SideLink>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {bar}
      <div className="mt-1 grid grid-cols-2">
        {sides.map((s, i) => (
          <SideLink
            key={s.key}
            href={s.href}
            className={cn(
              "flex min-h-14 flex-col justify-center gap-0.5 rounded-xl py-2",
              i === 1 && "items-end text-right",
              s.href && "-mx-2 px-2 hover:bg-accent/60",
            )}
          >
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <s.icon aria-hidden className="size-3.5" />
              {s.label}
            </span>
            <Money value={s.value} currency={currency} size="row-strong" />
          </SideLink>
        ))}
      </div>
    </div>
  );
}

function SideLink({
  href,
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

export function SplitBarSkeleton({
  surface = "default",
  className,
}: {
  surface?: Surface;
  className?: string;
}) {
  const sk = surface === "hero" ? HERO_SKELETON : undefined;
  return (
    <div className={cn("space-y-3", className)}>
      <Skeleton className={cn("h-1 w-full rounded-full", sk)} />
      <div className="flex justify-between">
        <Skeleton className={cn("h-9 w-24", sk)} />
        <Skeleton className={cn("h-9 w-24", sk)} />
      </div>
    </div>
  );
}

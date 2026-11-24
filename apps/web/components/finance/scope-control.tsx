"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import type { Scope, Surface } from "./types";

export type ScopeControlProps = {
  value: Scope;
  onChange: (value: Scope) => void;
  /**
   * Members of the Space. With one member the control is not rendered
   * (SPEC §4.3: no scope and no locks in a one-person Space).
   */
  memberCount: number;
  /**
   * "default": N5, full width (Accounts, Budget, Analytics, filters sheet).
   * "hero": compact glass pill inside the Home balance card.
   */
  surface?: Surface;
  className?: string;
};

const SCOPES: Scope[] = ["everything", "shared", "only-you"];

/** N5 — Everything · Shared · Only you, on `ToggleGroup variant="segmented"`. */
export function ScopeControl({
  value,
  onChange,
  memberCount,
  surface = "default",
  className,
}: ScopeControlProps) {
  const t = useTranslations("Finance.scope");
  if (memberCount < 2) return null;
  const hero = surface === "hero";
  const label = (s: Scope) =>
    s === "everything" ? t(hero ? "everythingShort" : "everything") : s === "shared" ? t("shared") : t("onlyYou");

  return (
    <ToggleGroup
      variant="segmented"
      value={[value]}
      onValueChange={(v: string[]) => {
        const next = v[0] as Scope | undefined;
        if (next && next !== value) onChange(next);
      }}
      aria-label={t("label")}
      className={cn(
        hero &&
          // Compact glass pill; the extra `after:` keeps a 44 px hit area.
          "h-auto w-fit gap-0 rounded-xl border border-hero-foreground/10 bg-hero-foreground/5 p-0.5",
        className,
      )}
    >
      {SCOPES.map((s) => (
        <ToggleGroupItem
          key={s}
          value={s}
          className={cn(
            hero &&
              "relative h-auto flex-none rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-hero-muted after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] hover:text-hero-foreground aria-pressed:bg-hero-foreground/15 aria-pressed:text-hero-foreground aria-pressed:shadow-none aria-pressed:hover:bg-hero-foreground/15",
          )}
        >
          {label(s)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function ScopeControlSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-11 w-full rounded-xl", className)} />;
}

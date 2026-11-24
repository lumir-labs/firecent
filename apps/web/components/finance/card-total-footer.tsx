import { ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { Money, type MoneyTone } from "./money";

export type CardTotalFooterProps = {
  /** "To pay in next 7 days". */
  label: string;
  value: number;
  currency: string;
  tone?: MoneyTone;
  approx?: boolean;
  /** Optional link under the total, right-aligned. */
  action?: { label: string; href: string };
  className?: string;
};

/** E12 — total at the bottom of a card (`border-t`). */
export function CardTotalFooter({
  label,
  value,
  currency,
  tone = "plain",
  approx,
  action,
  className,
}: CardTotalFooterProps) {
  return (
    <div className={cn("border-t px-4 py-3 text-[13px]", className)}>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground">{label}</span>
        <Money
          value={value}
          currency={currency}
          tone={tone}
          approx={approx}
          className="font-semibold"
        />
      </p>
      {action && (
        <Link
          href={action.href}
          className="-mr-2 -mb-2 ml-auto flex h-11 w-fit items-center gap-0.5 rounded-xl px-2 text-[14px] font-medium text-primary-text hover:bg-accent"
        >
          {action.label}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      )}
    </div>
  );
}

export function CardTotalFooterSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-between border-t px-4 py-3.5", className)}>
      <Skeleton className="h-3.5 w-32" />
      <Skeleton className="h-3.5 w-16" />
    </div>
  );
}

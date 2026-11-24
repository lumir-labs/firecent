import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type SectionHeaderProps = {
  title: ReactNode;
  /** Id for `aria-labelledby` on the wrapping section. */
  id?: string;
  /** Link at the right, e.g. `{ label: "All 44 transactions", href: "/transactions" }`. */
  action?: { label: string; href: string };
  /** Small count pill after the title ("Needs your attention 3"). */
  count?: number;
  /** One line under the title (13 px muted). */
  description?: ReactNode;
  /** Heading level. Default h2. */
  as?: "h2" | "h3";
  className?: string;
};

/**
 * E7 — section title (17 px) with an optional text link. The link keeps a
 * 44 px target with negative margins so the visual baseline does not move.
 */
export function SectionHeader({
  title,
  id,
  action,
  count,
  description,
  as: Heading = "h2",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Heading
            id={id}
            className="text-[17px] font-semibold tracking-[-0.01em]"
          >
            {title}
          </Heading>
          {count != null && (
            <span className="num inline-flex h-5 items-center rounded-full bg-muted px-2 text-[12px] font-semibold text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          className="-my-3 -mr-2 flex h-11 shrink-0 items-center gap-0.5 rounded-xl px-2 text-[14px] font-medium text-primary-text hover:bg-accent"
        >
          {action.label}
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      )}
    </div>
  );
}

export function SectionHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

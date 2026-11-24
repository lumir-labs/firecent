import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: ReactNode;
  /** Desktop only: one line under the title (13 px muted). */
  subtitle?: ReactNode;
  /** Parent route. Makes it a child screen (N1) with a back button. */
  back?: string;
  /** Accessible name of the back button (default "Back"; better: the parent's name). */
  backLabel?: string;
  /** Mobile: up to two icon buttons (E2) or one text button (E16). */
  actions?: ReactNode;
  /** Desktop actions (labeled buttons, h-10). Defaults to `actions`. */
  desktopActions?: ReactNode;
  className?: string;
};

/**
 * Page title, one `h1` at every width.
 * Mobile: a child screen is N1 (`h-14` bar, back + 17 px title + actions); a
 * root screen gets the 28 px title. Desktop (lg): 24 px title, optional
 * subtitle, actions on the right.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  backLabel,
  actions,
  desktopActions,
  className,
}: PageHeaderProps) {
  const t = useTranslations("Finance.header");
  const child = back != null;
  const desk = desktopActions ?? actions;

  return (
    <header
      className={cn(
        "flex items-center lg:h-auto lg:gap-3 lg:px-0 lg:pt-8",
        child ? "h-14 gap-1 px-2" : "min-h-14 gap-2 px-5 pt-2",
        className,
      )}
    >
      {child && (
        <Link
          href={back}
          aria-label={backLabel ?? t("back")}
          className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-accent lg:-ml-2 lg:size-10"
        >
          <ChevronLeft aria-hidden className="size-[22px] lg:size-5" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1
          className={cn(
            "truncate font-semibold lg:text-[24px] lg:leading-[32px] lg:tracking-[-0.02em]",
            child
              ? "text-[17px] tracking-[-0.01em]"
              : "text-[28px] leading-[34px] tracking-[-0.02em]",
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="hidden truncate text-[13px] text-muted-foreground lg:block">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center lg:hidden">{actions}</div>}
      {desk && <div className="hidden shrink-0 items-center gap-2 lg:flex">{desk}</div>}
    </header>
  );
}

export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-14 items-center px-5 lg:h-auto lg:px-0 lg:pt-8", className)}>
      <Skeleton className="h-6 w-40 lg:h-8 lg:w-56" />
    </div>
  );
}

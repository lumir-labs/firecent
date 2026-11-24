import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type FieldRowProps = {
  label: string;
  value: ReactNode;
  /** Opens a picker or sheet. Client parents only. */
  onClick?: () => void;
  href?: string;
  className?: string;
};

/**
 * N7 — label / value row inside a card (detail sheets, settings). Shows a
 * chevron when it opens something.
 */
export function FieldRow({ label, value, onClick, href, className }: FieldRowProps) {
  const interactive = Boolean(href || onClick);
  const body = (
    <>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-right font-medium">
        <span className="min-w-0 truncate">{value}</span>
        {interactive && (
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        )}
      </span>
    </>
  );
  const cls = cn(
    "flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left",
    interactive && "transition-colors hover:bg-accent/60",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

export function FieldRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-14 items-center justify-between px-4", className)}>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}

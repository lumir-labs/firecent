import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type NavRowProps = {
  icon: LucideIcon;
  label: string;
  /** Right-aligned preview (`$36,398.47`, "3 due"). Numbers get `.num`. */
  preview?: ReactNode;
  /** Small marker after the label (e.g. an unread dot or a Badge). */
  badge?: ReactNode;
  href: string;
  className?: string;
};

/** N15 — navigation row (More, Settings). */
export function NavRow({ icon: Icon, label, preview, badge, href, className }: NavRowProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-14 items-center gap-3 px-4 transition-colors hover:bg-accent/60",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted"
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-medium">{label}</span>
        {badge}
      </span>
      {preview != null && (
        <span className="num shrink-0 text-[14px] text-muted-foreground">{preview}</span>
      )}
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function NavRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-14 items-center gap-3 px-4", className)}>
      <Skeleton className="size-9 rounded-xl" />
      <Skeleton className="h-4 flex-1" />
    </div>
  );
}

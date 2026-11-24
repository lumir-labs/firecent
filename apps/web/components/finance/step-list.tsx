import { Check, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type Step = {
  title: string;
  body?: string;
  done?: boolean;
  /** The next real step: violet number, `aria-current="step"`. */
  active?: boolean;
  href?: string;
};

export type StepListProps = {
  steps: Step[];
  className?: string;
};

/**
 * E19 — numbered steps (Home empty state, onboarding). Done steps swap the
 * number for a check and quiet their title, so the active one leads.
 */
export function StepList({ steps, className }: StepListProps) {
  const t = useTranslations("Finance.steps");
  return (
    <ol className={cn("divide-y rounded-2xl border bg-card", className)}>
      {steps.map((s, i) => {
        const body = (
          <>
            <span
              className={cn(
                "num grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold",
                s.done
                  ? "bg-primary/10 text-primary-text"
                  : s.active
                    ? "bg-primary text-primary-foreground"
                    : "border text-muted-foreground",
              )}
            >
              {s.done ? (
                <>
                  <Check aria-hidden className="size-4" strokeWidth={2.5} />
                  <span className="sr-only">{t("done")}</span>
                </>
              ) : (
                i + 1
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block font-medium", s.done && "text-muted-foreground")}>
                {s.title}
              </span>
              {s.body && (
                <span className="mt-0.5 block text-[13px] text-muted-foreground">{s.body}</span>
              )}
            </span>
            {s.href && (
              <ChevronRight aria-hidden className="size-[18px] shrink-0 text-muted-foreground" />
            )}
          </>
        );
        const cls = cn(
          "flex items-center gap-3.5 p-4",
          s.href && "hover:bg-accent/60",
          i === 0 && "rounded-t-2xl",
          i === steps.length - 1 && "rounded-b-2xl",
        );
        return (
          <li key={s.title} aria-current={s.active ? "step" : undefined}>
            {s.href ? (
              <Link href={s.href} className={cls}>
                {body}
              </Link>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function StepListSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("divide-y rounded-2xl border bg-card", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3.5 p-4">
          <Skeleton className="size-7 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

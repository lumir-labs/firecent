import { cn } from "@/lib/utils";

export type PaceLegendProps = {
  /** Already translated, e.g. `t("Finance.pace.today", { percent: 40 })` → "Today · 40% pace". */
  label: string;
  className?: string;
};

/** E20 — explains the pace marker drawn on NatureBar. */
export function PaceLegend({ label, className }: PaceLegendProps) {
  return (
    <p className={cn("mt-2 flex items-center gap-2 text-[12px] text-muted-foreground", className)}>
      <span aria-hidden="true" className="h-3 w-0.5 shrink-0 rounded-full bg-foreground/45" />
      {label}
    </p>
  );
}

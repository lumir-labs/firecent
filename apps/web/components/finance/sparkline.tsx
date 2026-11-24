import { useId } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { Surface } from "./types";
import { HERO_SKELETON } from "./utils";

/** Smooth path through the points (Catmull-Rom as cubic Bézier, tension 0.3). */
export function sparklinePath(points: number[]): {
  line: string;
  area: string;
  last: { x: number; y: number };
} {
  const vals = points.length > 1 ? points : [points[0] ?? 0, points[0] ?? 0];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  // A flat series sits in the middle instead of the floor.
  const flat = max === min;
  const pts = vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * 100,
    y: flat ? 36 : 12 + (1 - (v - min) / span) * 48,
  }));
  const f = (n: number) => n.toFixed(2);
  const t = 0.3;
  let d = `M ${f(pts[0]!.x)} ${f(pts[0]!.y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[0]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    d +=
      ` C ${f(p1.x + (p2.x - p0.x) * t)} ${f(p1.y + (p2.y - p0.y) * t)},` +
      ` ${f(p2.x - (p3.x - p1.x) * t)} ${f(p2.y - (p3.y - p1.y) * t)},` +
      ` ${f(p2.x)} ${f(p2.y)}`;
  }
  return { line: d, area: `${d} L 100 72 L 0 72 Z`, last: pts[pts.length - 1]! };
}

export type SparklineProps = {
  points: number[];
  /** Summary of the data in words (SPEC §4.4), e.g. "Balance over six months, from $31,240 to $36,398". */
  ariaLabel: string;
  surface?: Surface;
  /** End-point dot. Default true. */
  showDot?: boolean;
  /** Height lives here: default `h-[68px]` (home: `lg:h-[118px]`). */
  className?: string;
};

/**
 * E5 — trend line. Own SVG, `viewBox 0 0 100 72` stretched to the box
 * (`preserveAspectRatio="none"`) with a non-scaling 2 px stroke, so it fills
 * any width. Area gradient 16% → 0 (hero: 28%). Server-compatible.
 */
export function Sparkline({
  points,
  ariaLabel,
  surface = "default",
  showDot = true,
  className,
}: SparklineProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const hero = surface === "hero";
  const { line, area, last } = sparklinePath(points);
  const stroke = hero ? "var(--hero-line)" : "var(--primary)";

  return (
    <div className={cn("relative h-[68px]", className)} data-slot="sparkline">
      <svg
        className="absolute inset-0 size-full overflow-visible"
        viewBox="0 0 100 72"
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: stroke, stopOpacity: hero ? 0.28 : 0.16 }} />
            <stop offset="1" style={{ stopColor: stroke, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id}f)`} />
        <path
          d={line}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ stroke }}
        />
      </svg>
      {showDot && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute right-0 size-2.5 translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px]",
            hero ? "bg-hero-line ring-hero" : "bg-primary ring-background",
          )}
          style={{ top: `${((last.y / 72) * 100).toFixed(2)}%` }}
        />
      )}
    </div>
  );
}

export function SparklineSkeleton({
  surface = "default",
  className,
}: {
  surface?: Surface;
  className?: string;
}) {
  return (
    <Skeleton
      className={cn("h-[68px] w-full rounded-xl", surface === "hero" && HERO_SKELETON, className)}
    />
  );
}

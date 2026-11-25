import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Blaze AI assistant mark — a 4-point AI star forged in Firecent's dual-ribbon
 * flame geometry and brand gradients (ember orange + electric indigo), paired
 * with a satellite micro-spark so it reads instantaneously as AI at 18–24 px.
 *
 * - `color`: Firecent ember + indigo brand gradients (default).
 * - `mono`: `currentColor` (inactive mobile tab bar, tinted badges).
 * Decorative unless `title` is given (then `role="img"` + label).
 */

const BLAZE_TOP =
  "M10.4 2.8 C11.0 7.9 13.4 10.4 17.4 11.0 C13.4 11.4 9.6 11.1 5.8 12.2 C4.0 12.7 2.7 13.1 1.8 13.0 C6.5 11.3 9.3 8.1 10.4 2.8 Z";
const BLAZE_BOTTOM =
  "M18.6 12.6 C13.6 13.6 10.9 16.8 10.0 21.8 C9.2 17.3 6.9 15.1 3.6 14.5 C6.8 14.0 10.4 13.1 14.0 13.0 C15.8 12.9 17.4 12.8 18.6 12.6 Z";
const BLAZE_SPARK =
  "M19.4 2.2 C19.65 3.9 20.5 4.75 22.2 5.0 C20.5 5.25 19.65 6.1 19.4 7.8 C19.15 6.1 18.3 5.25 16.6 5.0 C18.3 4.75 19.15 3.9 19.4 2.2 Z";

export type BlazeIconProps = {
  variant?: "color" | "mono";
  /** Accessible name. Omit when the mark is decorative. */
  title?: string;
  className?: string;
};

export function BlazeIcon({
  variant = "color",
  title,
  className,
}: BlazeIconProps) {
  // Unique gradient ids: several icons on one page must not share defs.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mono = variant === "mono";
  const a11y = title
    ? { role: "img" as const, "aria-label": title }
    : { "aria-hidden": true as const };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      focusable="false"
      data-slot="blaze-icon"
      className={cn("size-5 shrink-0", className)}
      {...a11y}
    >
      {!mono && (
        <defs>
          <linearGradient
            id={`${id}o`}
            gradientUnits="userSpaceOnUse"
            x1="16"
            y1="3"
            x2="3"
            y2="13"
          >
            <stop offset="0" stopColor="#FFA64F" />
            <stop offset="0.52" stopColor="#FF7A3D" />
            <stop offset="1" stopColor="#FF3F3A" />
          </linearGradient>
          <linearGradient
            id={`${id}b`}
            gradientUnits="userSpaceOnUse"
            x1="18"
            y1="12.5"
            x2="7"
            y2="21.5"
          >
            <stop offset="0" stopColor="#9A88FB" />
            <stop offset="0.5" stopColor="#5E54F0" />
            <stop offset="1" stopColor="#3A2EDB" />
          </linearGradient>
          <linearGradient
            id={`${id}s`}
            gradientUnits="userSpaceOnUse"
            x1="21.5"
            y1="2.5"
            x2="17"
            y2="7.5"
          >
            <stop offset="0" stopColor="#FFA64F" />
            <stop offset="1" stopColor="#FF6B3D" />
          </linearGradient>
        </defs>
      )}
      <path d={BLAZE_TOP} fill={mono ? "currentColor" : `url(#${id}o)`} />
      <path d={BLAZE_BOTTOM} fill={mono ? "currentColor" : `url(#${id}b)`} />
      <path
        d={BLAZE_SPARK}
        fill={mono ? "currentColor" : `url(#${id}s)`}
        opacity={mono ? 0.85 : 1}
      />
    </svg>
  );
}

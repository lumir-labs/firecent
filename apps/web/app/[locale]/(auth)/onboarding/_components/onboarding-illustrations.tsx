"use client";

import * as React from "react";

/**
 * Onboarding illustrations — one shared flat style:
 * brand indigo (#5E54F0 / #7C5CFF), Firecent orange (#FF6B3D), amber coins (#FFB547),
 * soft badge backgrounds that adapt to dark mode via Tailwind fill classes.
 */

type IllustrationProps = { className?: string };

const BADGE = "fill-[#EEEDFF] dark:fill-primary/15";
const SKIN_A = "#F6CBA6";
const SKIN_B = "#D9A07A";
const SKIN_C = "#B97A56";
const HAIR = "#2B2350";

/** Unique, SVG-safe ids so several copies on a page don't clash. */
function useSvgId(prefix: string) {
  return `${prefix}-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** Head with hair cap + fringe, drawn at (cx, cy) with radius r. */
function Head({ cx, cy, r, skin, hair = HAIR }: { cx: number; cy: number; r: number; skin: string; hair?: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={skin} />
      <path
        d={`M ${cx - r} ${cy - r * 0.05}
            A ${r} ${r} 0 0 1 ${cx + r} ${cy - r * 0.05}
            C ${cx + r * 0.55} ${cy - r * 0.45} ${cx + r * 0.1} ${cy - r * 0.55} ${cx - r * 0.25} ${cy - r * 0.35}
            C ${cx - r * 0.55} ${cy - r * 0.2} ${cx - r * 0.8} ${cy - r * 0.15} ${cx - r} ${cy - r * 0.05} Z`}
        fill={hair}
      />
      <circle cx={cx - r * 0.36} cy={cy + r * 0.18} r={Math.max(1, r * 0.1)} fill={HAIR} />
      <circle cx={cx + r * 0.36} cy={cy + r * 0.18} r={Math.max(1, r * 0.1)} fill={HAIR} />
    </g>
  );
}

export function GroupAvatarIllustration({ className = "size-12" }: IllustrationProps) {
  const clip = useSvgId("grp");
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <rect width="80" height="80" rx="22" />
        </clipPath>
      </defs>
      <rect width="80" height="80" rx="22" className={BADGE} />
      <g clipPath={`url(#${clip})`}>
        {/* Back left */}
        <path d="M 6 80 C 6 62 13 53 23 53 C 33 53 40 62 40 80 Z" fill="#FF8A5B" />
        <Head cx={23} cy={40} r={8.5} skin={SKIN_B} />
        {/* Back right */}
        <path d="M 40 80 C 40 62 47 53 57 53 C 67 53 74 62 74 80 Z" fill="#A9A3FF" />
        <Head cx={57} cy={40} r={8.5} skin={SKIN_C} hair="#4A3424" />
        {/* Front */}
        <path d="M 20 80 C 20 64 28 57 40 57 C 52 57 60 64 60 80 Z" fill="#5E54F0" />
        <path d="M 35 57.5 L 40 63 L 45 57.5" stroke="#EEEDFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Head cx={40} cy={44} r={10.5} skin={SKIN_A} />
      </g>
      {/* Shared coin */}
      <circle cx="62" cy="18" r="8" fill="#FFB547" />
      <circle cx="62" cy="18" r="5.2" stroke="#E8912D" strokeWidth="1.5" />
    </svg>
  );
}

export function PersonalAvatarIllustration({ className = "size-12" }: IllustrationProps) {
  const clip = useSvgId("per");
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <rect width="80" height="80" rx="22" />
        </clipPath>
      </defs>
      <rect width="80" height="80" rx="22" className={BADGE} />
      <g clipPath={`url(#${clip})`}>
        <path d="M 16 80 C 16 61 26 53 40 53 C 54 53 64 61 64 80 Z" fill="#5E54F0" />
        <path d="M 34 53.5 L 40 60 L 46 53.5" stroke="#EEEDFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Head cx={40} cy={38} r={12} skin={SKIN_A} />
        {/* Phone with a mini chart */}
        <g transform="rotate(-8 58 64)">
          <rect x="49" y="52" width="18" height="27" rx="4" fill="#2B2350" />
          <rect x="51.5" y="55" width="13" height="19" rx="2" fill="#FFFFFF" />
          <path d="M 53.5 70 L 57 66 L 59.5 68 L 63 62.5" stroke="#FF6B3D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
      {/* Sparkle */}
      <path d="M 18 16 L 19.6 20.4 L 24 22 L 19.6 23.6 L 18 28 L 16.4 23.6 L 12 22 L 16.4 20.4 Z" fill="#FFB547" />
    </svg>
  );
}

export function BusinessIllustration({ className = "size-12" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
      <rect width="80" height="80" rx="22" className={BADGE} />
      {/* Handle */}
      <path d="M 32 29 V 25 C 32 22.8 33.8 21 36 21 H 44 C 46.2 21 48 22.8 48 25 V 29" stroke="#3F36C9" strokeWidth="3.5" strokeLinecap="round" />
      {/* Body */}
      <rect x="16" y="29" width="48" height="33" rx="8" fill="#5E54F0" />
      {/* Lid seam */}
      <path d="M 16 42 C 26 46 54 46 64 42" stroke="#3F36C9" strokeWidth="2" />
      {/* Clasp */}
      <rect x="35" y="39" width="10" height="9" rx="2.5" fill="#FF6B3D" />
      {/* Growth badge */}
      <circle cx="62" cy="58" r="11" fill="#FFFFFF" className="dark:fill-[#1B2234]" />
      <circle cx="62" cy="58" r="11" stroke="#E4E2FF" strokeWidth="1.5" className="dark:stroke-primary/30" />
      <path d="M 56.5 61.5 L 60.5 57.5 L 63 60 L 67.5 55" stroke="#FF6B3D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 64 55 H 67.5 V 58.5" stroke="#FF6B3D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function VaultIllustration({ className = "size-28" }: IllustrationProps) {
  const grad = useSvgId("vault");
  return (
    <svg viewBox="0 0 140 140" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C5CFF" />
          <stop offset="100%" stopColor="#5E54F0" />
        </linearGradient>
      </defs>

      <circle cx="70" cy="70" r="62" className="fill-[#EEEDFF] dark:fill-primary/15" />

      {/* Feet */}
      <rect x="38" y="104" width="12" height="8" rx="3" fill="#3F36C9" />
      <rect x="80" y="104" width="12" height="8" rx="3" fill="#3F36C9" />

      {/* Body */}
      <rect x="26" y="30" width="78" height="78" rx="18" fill={`url(#${grad})`} />
      {/* Door */}
      <rect x="35" y="39" width="60" height="60" rx="12" fill="#6F66F7" stroke="#A9A3FF" strokeOpacity="0.6" strokeWidth="2" />
      {/* Hinges */}
      <rect x="30" y="50" width="7" height="11" rx="2.5" fill="#3F36C9" />
      <rect x="30" y="77" width="7" height="11" rx="2.5" fill="#3F36C9" />

      {/* Dial */}
      <circle cx="65" cy="69" r="17" fill="#EEEDFF" />
      <circle cx="65" cy="69" r="11" fill="#FFFFFF" stroke="#C9C5FF" strokeWidth="2" />
      <path d="M 65 69 L 71 62" stroke="#3F36C9" strokeWidth="3" strokeLinecap="round" />
      <circle cx="65" cy="69" r="2.5" fill="#3F36C9" />
      {[0, 90, 180, 270].map((deg) => (
        <line
          key={deg}
          x1="65"
          y1="54"
          x2="65"
          y2="56.5"
          stroke="#8F88FF"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${deg} 65 69)`}
        />
      ))}

      {/* Coin stack */}
      <g>
        <ellipse cx="110" cy="104" rx="15" ry="5.5" fill="#E8912D" />
        <rect x="95" y="97" width="30" height="7" fill="#E8912D" />
        <ellipse cx="110" cy="97" rx="15" ry="5.5" fill="#FFB547" />
        <ellipse cx="110" cy="92" rx="15" ry="5.5" fill="#E8912D" />
        <rect x="95" y="85" width="30" height="7" fill="#E8912D" />
        <ellipse cx="110" cy="85" rx="15" ry="5.5" fill="#FFC56B" />
        <ellipse cx="110" cy="85" rx="9" ry="3" stroke="#E8912D" strokeWidth="1.5" />
      </g>

      {/* Sparkles */}
      <path d="M 112 22 L 114 28 L 120 30 L 114 32 L 112 38 L 110 32 L 104 30 L 110 28 Z" fill="#FF6B3D" />
      <circle cx="22" cy="36" r="3" fill="#FFB547" />
    </svg>
  );
}

export function SuccessCelebrationIllustration({ className = "size-32" }: IllustrationProps) {
  const grad = useSvgId("success");
  return (
    <svg viewBox="0 0 160 160" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C5CFF" />
          <stop offset="100%" stopColor="#5E54F0" />
        </linearGradient>
      </defs>

      <circle cx="80" cy="80" r="58" className="fill-[#EEEDFF] dark:fill-primary/15" />

      {/* Confetti */}
      <rect x="77" y="8" width="6" height="16" rx="3" fill="#FF6B3D" />
      <rect x="116" y="22" width="6" height="14" rx="3" fill="#FFB547" transform="rotate(38 119 29)" />
      <rect x="38" y="22" width="6" height="14" rx="3" fill="#7C5CFF" transform="rotate(-38 41 29)" />
      <rect x="134" y="70" width="14" height="6" rx="3" fill="#7C5CFF" />
      <rect x="12" y="74" width="14" height="6" rx="3" fill="#FF6B3D" />
      <rect x="122" y="112" width="6" height="14" rx="3" fill="#FF6B3D" transform="rotate(-40 125 119)" />
      <rect x="32" y="112" width="6" height="14" rx="3" fill="#FFB547" transform="rotate(40 35 119)" />
      <circle cx="132" cy="44" r="3.5" fill="#FF6B3D" />
      <circle cx="26" cy="48" r="3" fill="#FFB547" />
      <circle cx="104" cy="140" r="3" fill="#7C5CFF" />
      <circle cx="54" cy="138" r="3.5" fill="#FF6B3D" />

      {/* Check badge */}
      <circle cx="80" cy="80" r="38" fill={`url(#${grad})`} />
      <circle cx="80" cy="80" r="31" stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="2" />
      <path
        d="M 64 81 L 75 92 L 97 69"
        stroke="#FFFFFF"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

import {
  Banknote,
  CreditCard,
  Landmark,
  PiggyBank,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountType } from "./types";

export type MetallicFinishKey =
  | "gold"
  | "silver"
  | "platinum"
  | "rose-gold"
  | "obsidian";

export type PresetColorKey =
  | "indigo"
  | "blue"
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "slate";

export type ResolvedFinish = {
  key: string;
  kind: "metallic" | "solid";
  /** Rich gradient used for credit cards, metallic finishes, and detail hero cards. */
  cardBackground: string;
  /** Solid accent swatch used for dots, borders, and bank account badges. */
  accent: string;
  /** High-contrast foreground text color on top of `cardBackground`. */
  ink: string;
  /** Secondary text color on top of `cardBackground`. */
  mutedInk: string;
  /** Subtle inner specular ring for metallic realism. */
  border: string;
};

export const METALLIC_FINISHES: {
  key: MetallicFinishKey;
  labelEn: string;
  labelEs: string;
  finish: ResolvedFinish;
}[] = [
  {
    key: "gold",
    labelEn: "Gold",
    labelEs: "Oro",
    finish: {
      key: "gold",
      kind: "metallic",
      cardBackground:
        "linear-gradient(135deg, #b8861b 0%, #ebd282 42%, #d4a63a 70%, #996c14 100%)",
      accent: "#c9982e",
      ink: "#261903",
      mutedInk: "rgba(38, 25, 3, 0.72)",
      border: "rgba(255, 245, 204, 0.55)",
    },
  },
  {
    key: "silver",
    labelEn: "Silver",
    labelEs: "Plata",
    finish: {
      key: "silver",
      kind: "metallic",
      cardBackground:
        "linear-gradient(135deg, #7c899b 0%, #e5ebf1 44%, #b6c2d0 72%, #64748b 100%)",
      accent: "#94a3b8",
      ink: "#0f172a",
      mutedInk: "rgba(15, 23, 42, 0.70)",
      border: "rgba(255, 255, 255, 0.65)",
    },
  },
  {
    key: "platinum",
    labelEn: "Platinum",
    labelEs: "Platino",
    finish: {
      key: "platinum",
      kind: "metallic",
      cardBackground:
        "linear-gradient(135deg, #3b4656 0%, #b8c4d4 44%, #64748b 72%, #293342 100%)",
      accent: "#64748b",
      ink: "#0b1220",
      mutedInk: "rgba(11, 18, 32, 0.72)",
      border: "rgba(226, 232, 240, 0.45)",
    },
  },
  {
    key: "rose-gold",
    labelEn: "Rose Gold",
    labelEs: "Oro rosa",
    finish: {
      key: "rose-gold",
      kind: "metallic",
      cardBackground:
        "linear-gradient(135deg, #a66253 0%, #f0ccc2 44%, #cf9082 72%, #86493c 100%)",
      accent: "#c47f70",
      ink: "#29100a",
      mutedInk: "rgba(41, 16, 10, 0.72)",
      border: "rgba(255, 235, 229, 0.55)",
    },
  },
  {
    key: "obsidian",
    labelEn: "Obsidian",
    labelEs: "Negro",
    finish: {
      key: "obsidian",
      kind: "metallic",
      cardBackground:
        "linear-gradient(135deg, #2b3446 0%, #141c2c 48%, #090e18 100%)",
      accent: "#1e293b",
      ink: "#f8fafc",
      mutedInk: "rgba(248, 250, 252, 0.70)",
      border: "rgba(255, 255, 255, 0.14)",
    },
  },
];

export const ACCOUNT_COLOR_PRESETS: {
  key: PresetColorKey;
  hex: string;
  labelEn: string;
  labelEs: string;
}[] = [
  { key: "indigo", hex: "#5e54f0", labelEn: "Indigo", labelEs: "Índigo" },
  { key: "blue", hex: "#0148af", labelEn: "Blue", labelEs: "Azul" },
  { key: "sky", hex: "#0284c7", labelEn: "Sky", labelEs: "Celeste" },
  { key: "emerald", hex: "#059669", labelEn: "Emerald", labelEs: "Verde" },
  { key: "amber", hex: "#d97706", labelEn: "Amber", labelEs: "Ámbar" },
  { key: "rose", hex: "#e11d48", labelEn: "Rose", labelEs: "Rojo" },
  { key: "violet", hex: "#7c3aed", labelEn: "Violet", labelEs: "Violeta" },
  { key: "slate", hex: "#334155", labelEn: "Slate", labelEs: "Gris" },
];

function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function shiftHex(hex: string, factor: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const [r, g, b] = rgb.map((v) =>
    factor >= 1
      ? clamp(v + (255 - v) * (factor - 1))
      : clamp(v * factor),
  );
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function isLightHex(hex: string): boolean {
  const rgb = parseHex(hex);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.62;
}

function buildSolidFinish(key: string, hex: string): ResolvedFinish {
  const light = isLightHex(hex);
  const top = shiftHex(hex, 1.12);
  const bottom = shiftHex(hex, 0.72);
  return {
    key,
    kind: "solid",
    cardBackground: `linear-gradient(135deg, ${top} 0%, ${hex} 50%, ${bottom} 100%)`,
    accent: hex,
    ink: light ? "#0b1220" : "#ffffff",
    mutedInk: light ? "rgba(11, 18, 32, 0.72)" : "rgba(255, 255, 255, 0.78)",
    border: light ? "rgba(11, 18, 32, 0.14)" : "rgba(255, 255, 255, 0.18)",
  };
}

/**
 * Resolves `BankAccount.color` (metallic preset, color preset, or custom `#RRGGBB`)
 * into a ready-to-render visual finish with WCAG-safe ink contrast.
 */
export function resolveAccountFinish(
  color?: string | null,
): ResolvedFinish | null {
  if (!color) return null;
  const norm = color.trim().toLowerCase();

  const metallic = METALLIC_FINISHES.find((m) => m.key === norm);
  if (metallic) return metallic.finish;

  const preset = ACCOUNT_COLOR_PRESETS.find((p) => p.key === norm);
  if (preset) return buildSolidFinish(preset.key, preset.hex);

  if (parseHex(norm)) {
    return buildSolidFinish(norm, norm.startsWith("#") ? norm : `#${norm}`);
  }

  return null;
}

const ICONS = {
  CHECKING_ACCOUNT: Landmark,
  BANK: Landmark,
  SAVINGS_ACCOUNT: PiggyBank,
  CASH: Banknote,
  CREDIT_CARD: CreditCard,
  GENERAL: Wallet,
} as const;

/**
 * Compact account visual badge:
 * - Credit & debit cards (or any account with a metallic finish) render a sleek
 *   mini card with its brushed-metal / tonal gradient and tiny chip bar.
 * - Bank/savings/cash accounts render a crisp rounded tile with their color accent.
 */
export function AccountSwatch({
  type,
  color,
  hasCard,
  size = "md",
  className,
}: {
  type: AccountType;
  color?: string | null;
  hasCard?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const finish = resolveAccountFinish(color);
  const Icon = ICONS[type] ?? Wallet;
  const asMiniCard =
    type === "CREDIT_CARD" ||
    type === "CHECKING_ACCOUNT" ||
    (type === "SAVINGS_ACCOUNT"
      ? Boolean(hasCard)
      : type !== "CASH" && finish?.kind === "metallic");

  if (asMiniCard) {
    const bg =
      finish?.cardBackground ??
      "linear-gradient(135deg, #334155 0%, #1e293b 55%, #0f172a 100%)";
    const border = finish?.border ?? "rgba(255,255,255,0.14)";
    const ink = finish?.ink ?? "#f8fafc";

    return (
      <span
        aria-hidden
        style={{ background: bg, borderColor: border, color: ink }}
        className={cn(
          // True ID-1 credit card proportion (~1.58:1) with crisp card corners
          // (not `rounded-lg`, which resolves to 12px = jellybean at 24px height).
          "relative inline-flex shrink-0 flex-col justify-between overflow-hidden border shadow-xs",
          size === "sm"
            ? "h-[19px] w-[30px] rounded-[4px] px-[4px] py-[3px]"
            : "h-[28px] w-[44px] rounded-[6px] px-[5px] py-[4px]",
          className,
        )}
      >
        {/* Subtle metallic EMV chip */}
        <span
          className={cn(
            "rounded-[1.5px]",
            size === "sm" ? "h-[4px] w-[6px]" : "h-[6px] w-[8px]",
          )}
          style={{ backgroundColor: ink, opacity: 0.42 }}
        />
        {/* Subtle overlapping network mark */}
        <span className="flex items-center justify-end">
          <span
            className={cn(
              "rounded-full",
              size === "sm" ? "size-[4px]" : "size-[6px]",
            )}
            style={{ backgroundColor: ink, opacity: 0.4 }}
          />
          <span
            className={cn(
              "-ml-[1.5px] rounded-full",
              size === "sm" ? "size-[4px]" : "size-[6px]",
            )}
            style={{ backgroundColor: ink, opacity: 0.65 }}
          />
        </span>
      </span>
    );
  }

  // Bank / Savings / Cash: solid tonal badge using the same WCAG ink contrast
  // as cards so dark brand colors (#212121 n1co, #004e7c Banco Azul) stay crisp
  // on dark surfaces, centered in the same horizontal slot as mini cards.
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        size === "sm" ? "w-[30px]" : "w-[44px]",
        className,
      )}
    >
      <span
        style={
          finish
            ? {
                background: finish.cardBackground,
                color: finish.ink,
                borderColor: finish.border,
              }
            : undefined
        }
        className={cn(
          "grid place-items-center border shadow-xs",
          !finish && "border-transparent bg-muted text-foreground",
          size === "sm"
            ? "size-[26px] rounded-[7px] [&_svg]:size-[14px]"
            : "size-[36px] rounded-[10px] [&_svg]:size-[18px]",
        )}
      >
        <Icon strokeWidth={2} />
      </span>
    </span>
  );
}

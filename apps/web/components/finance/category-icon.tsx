import {
  Apple,
  Baby,
  Banknote,
  Beer,
  Bike,
  Book,
  Briefcase,
  Building2,
  Bus,
  Calculator,
  Camera,
  Car,
  ChartLine,
  CircleDashed,
  CircleParking,
  Clapperboard,
  Coffee,
  Coins,
  CreditCard,
  DollarSign,
  Droplet,
  Dumbbell,
  Euro,
  FileText,
  Film,
  Flame,
  Fuel,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  GraduationCap,
  Hammer,
  HandCoins,
  Heart,
  HeartHandshake,
  HeartPulse,
  Hotel,
  House,
  Key,
  Lamp,
  Landmark,
  Laptop,
  type LucideIcon,
  Monitor,
  Music,
  Package,
  Palette,
  PawPrint,
  Percent,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  PlusCircle,
  Popcorn,
  Receipt,
  Repeat,
  RotateCcw,
  Scissors,
  Shapes,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sofa,
  Sparkles,
  Stethoscope,
  Store,
  Tag,
  Target,
  Ticket,
  Train,
  TreePine,
  TrendingUp,
  Trophy,
  Truck,
  Tv,
  Umbrella,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Wine,
  Wrench,
  Zap,
  ArrowLeftRight,
} from "lucide-react";

import { createElement } from "react";

import { cn } from "@/lib/utils";

import type { ColorName } from "./types";
import { COLOR_TILE } from "./utils";

/**
 * Curated map (kebab-case Lucide names) instead of `import * as icons`: keeps
 * the client bundle small. `Category.icon` may hold kebab ("shopping-cart",
 * the demo seed) or Pascal ("ShoppingCart", older rows): both resolve.
 * Unknown names fall back to `tag`. Add here when a new category icon ships.
 */
const ICONS: Record<string, LucideIcon> = {
  apple: Apple,
  "arrow-left-right": ArrowLeftRight,
  baby: Baby,
  banknote: Banknote,
  beer: Beer,
  bike: Bike,
  book: Book,
  briefcase: Briefcase,
  "building-2": Building2,
  bus: Bus,
  calculator: Calculator,
  camera: Camera,
  car: Car,
  "chart-line": ChartLine,
  "circle-dashed": CircleDashed,
  "circle-parking": CircleParking,
  "parking-circle": CircleParking,
  clapperboard: Clapperboard,
  coffee: Coffee,
  coins: Coins,
  "credit-card": CreditCard,
  "dollar-sign": DollarSign,
  droplet: Droplet,
  dumbbell: Dumbbell,
  euro: Euro,
  "file-text": FileText,
  film: Film,
  flame: Flame,
  fuel: Fuel,
  "gamepad-2": Gamepad2,
  gem: Gem,
  gift: Gift,
  globe: Globe,
  "graduation-cap": GraduationCap,
  hammer: Hammer,
  "hand-coins": HandCoins,
  heart: Heart,
  "heart-handshake": HeartHandshake,
  "heart-pulse": HeartPulse,
  home: House,
  hotel: Hotel,
  house: House,
  key: Key,
  lamp: Lamp,
  landmark: Landmark,
  laptop: Laptop,
  monitor: Monitor,
  music: Music,
  package: Package,
  palette: Palette,
  "paw-print": PawPrint,
  percent: Percent,
  "piggy-bank": PiggyBank,
  pill: Pill,
  pizza: Pizza,
  plane: Plane,
  "plus-circle": PlusCircle,
  popcorn: Popcorn,
  receipt: Receipt,
  repeat: Repeat,
  "rotate-ccw": RotateCcw,
  scissors: Scissors,
  shapes: Shapes,
  shield: Shield,
  shirt: Shirt,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  smartphone: Smartphone,
  sofa: Sofa,
  sparkles: Sparkles,
  stethoscope: Stethoscope,
  store: Store,
  tag: Tag,
  target: Target,
  ticket: Ticket,
  train: Train,
  "tree-pine": TreePine,
  "trending-up": TrendingUp,
  trophy: Trophy,
  truck: Truck,
  tv: Tv,
  umbrella: Umbrella,
  users: Users,
  utensils: Utensils,
  wallet: Wallet,
  wifi: Wifi,
  wine: Wine,
  wrench: Wrench,
  zap: Zap,
};

const toKebab = (name: string) =>
  name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])(\d)/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();

/** Resolves a stored icon name to a Lucide component (fallback `Tag`). */
export function resolveCategoryIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Tag;
  return ICONS[name] ?? ICONS[toKebab(name)] ?? Tag;
}

export type CategoryIconSize = "sm" | "md" | "lg";

const TILE: Record<CategoryIconSize, string> = {
  sm: "size-9 [&_svg]:size-[18px]", // N11, N15
  md: "size-10 [&_svg]:size-5", // N2
  lg: "size-11 [&_svg]:size-5", // N16
};

export type CategoryIconProps = {
  /** Lucide name as stored in `Category.icon`, or a Lucide component. */
  icon?: string | LucideIcon | null | undefined;
  size?: CategoryIconSize;
  /**
   * Accepts a `ColorName` token OR any hex color (`#ec4899`, `#0284c7`, etc.).
   * Falls back to a neutral `bg-muted` tile when omitted.
   */
  color?: ColorName | string | null;
  /** Dedicated visual style for internal transfers (sky-blue tile + ArrowLeftRight). */
  variant?: "default" | "transfer";
  className?: string;
};

function hexStyle(hex: string): React.CSSProperties | undefined {
  const clean = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(clean)) return undefined;
  const r = Number.parseInt(clean.slice(1, 3), 16);
  const g = Number.parseInt(clean.slice(3, 5), 16);
  const b = Number.parseInt(clean.slice(5, 7), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // Very dark hexes (e.g. #212121, #334155) get a crisp solid tile with light ink
  if (luma < 0.25) {
    return {
      backgroundColor: clean,
      color: "#f8fafc",
      borderColor: "rgba(255, 255, 255, 0.14)",
    };
  }
  return {
    backgroundColor: `${clean}22`,
    color: clean,
    borderColor: `${clean}38`,
  };
}

const TRANSFER_TILE_CLASS =
  "border-sky-500/25 bg-sky-500/12 text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/15 dark:text-sky-300";

/** Icon tile for a category, account, or transfer. Decorative (`aria-hidden`). */
export function CategoryIcon({
  icon,
  size = "md",
  color,
  variant = "default",
  className,
}: CategoryIconProps) {
  const isTransfer = variant === "transfer";
  // createElement: the icon is looked up from a static map, not created here.
  const icon$ = createElement(
    isTransfer && icon == null
      ? ArrowLeftRight
      : typeof icon === "string" || icon == null
        ? resolveCategoryIcon(icon)
        : icon,
  );
  const tokenClass =
    !isTransfer && color && color in COLOR_TILE
      ? COLOR_TILE[color as ColorName]
      : undefined;
  const customStyle =
    !isTransfer && !tokenClass && color ? hexStyle(color) : undefined;

  return (
    <span
      aria-hidden="true"
      data-slot="category-icon"
      style={customStyle}
      className={cn(
        "grid shrink-0 place-items-center rounded-xl border border-transparent",
        isTransfer
          ? TRANSFER_TILE_CLASS
          : (tokenClass ?? (!customStyle && "bg-muted text-foreground")),
        TILE[size],
        className,
      )}
    >
      {icon$}
    </span>
  );
}

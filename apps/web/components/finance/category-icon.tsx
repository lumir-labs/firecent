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
  Popcorn,
  Receipt,
  Repeat,
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
  Trophy,
  Truck,
  Tv,
  Umbrella,
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
  popcorn: Popcorn,
  receipt: Receipt,
  repeat: Repeat,
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
  trophy: Trophy,
  truck: Truck,
  tv: Tv,
  umbrella: Umbrella,
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
  icon: string | LucideIcon | null | undefined;
  size?: CategoryIconSize;
  /**
   * SPEC §3.1 decision: tiles are neutral (`bg-muted`). The prototype HTML
   * tints them with the category color; pass `color` to opt in.
   */
  color?: ColorName | null;
  className?: string;
};

/** Icon tile for a category or account. Decorative (`aria-hidden`). */
export function CategoryIcon({
  icon,
  size = "md",
  color,
  className,
}: CategoryIconProps) {
  // createElement: the icon is looked up from a static map, not created here.
  const icon$ = createElement(
    typeof icon === "string" || icon == null ? resolveCategoryIcon(icon) : icon,
  );
  return (
    <span
      aria-hidden="true"
      data-slot="category-icon"
      className={cn(
        "grid shrink-0 place-items-center rounded-xl",
        color ? COLOR_TILE[color] : "bg-muted text-foreground",
        TILE[size],
        className,
      )}
    >
      {icon$}
    </span>
  );
}

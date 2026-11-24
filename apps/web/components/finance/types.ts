/**
 * Shared types for components/finance. Mirrors the Prisma enums as string
 * unions so client components never import @app/db.
 */

/** Prisma `SpendingNature`. UI names (D9): Owe / Need / Want. */
export type Nature = "DEBO" | "NECESITO" | "QUIERO";

/** Fixed display order (D9): Owe, Need, Want. */
export const NATURES: readonly Nature[] = ["DEBO", "NECESITO", "QUIERO"];

/** Prisma `RecordType`. */
export type TransactionKind = "EXPENSE" | "INCOME" | "TRANSFER";

/** Prisma `AccountType`. */
export type AccountType =
  | "GENERAL"
  | "BANK"
  | "SAVINGS_ACCOUNT"
  | "CHECKING_ACCOUNT"
  | "CASH"
  | "CREDIT_CARD";

/** Prisma `Colors`. Only for avatars, labels and (opt-in) icon tiles. */
export type ColorName =
  | "DEFAULT"
  | "GRAY"
  | "BROWN"
  | "ORANGE"
  | "YELLOW"
  | "GREEN"
  | "BLUE"
  | "PURPLE"
  | "PINK"
  | "RED";

/** Account visibility scope (SPEC §4.3). */
export type Scope = "everything" | "shared" | "only-you";

/**
 * Where a component sits.
 * - "hero": the always-dark balance card of Home (`bg-hero`).
 * - "tinted": custom metallic or colored card surfaces where the parent sets
 *   contrast-safe `color: ink`, so dimmed `$`/cents inherit ink via opacity.
 */
export type Surface = "default" | "hero" | "tinted";

/** A calendar day: "YYYY-MM-DD" (preferred) or a Date at UTC midnight. */
export type DayInput = string | Date;

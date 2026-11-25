import type { Prisma, PrismaClient } from "@app/db";

export type DefaultSubcategory = {
  nameEn: string;
  nameEs: string;
  icon: string;
  spendingNature?: "DEBO" | "NECESITO" | "QUIERO";
};

export type DefaultCategory = {
  nameEn: string;
  nameEs: string;
  icon: string;
  color: string;
  type: "EXPENSE" | "INCOME";
  spendingNature?: "DEBO" | "NECESITO" | "QUIERO";
  children?: DefaultSubcategory[];
};

/**
 * Canonical bilingual system categories (EN + ES) seeded into every new Space.
 * Clean, generalized hierarchy designed for fast daily entry without bloat.
 * `spendingNature` defaults power Analytics automatically without forcing
 * users to think about Owe/Need/Want on every screen.
 */
export const DEFAULT_SYSTEM_CATEGORIES: DefaultCategory[] = [
  // ── EXPENSES ──────────────────────────────────────────────────────────
  {
    nameEn: "Food & Dining",
    nameEs: "Comida",
    icon: "utensils",
    color: "#f97316",
    type: "EXPENSE",
    spendingNature: "NECESITO",
    children: [
      { nameEn: "Groceries", nameEs: "Supermercado", icon: "shopping-cart", spendingNature: "NECESITO" },
      { nameEn: "Restaurants", nameEs: "Restaurantes", icon: "utensils", spendingNature: "QUIERO" },
      { nameEn: "Coffee & Snacks", nameEs: "Café y snacks", icon: "coffee", spendingNature: "QUIERO" },
      { nameEn: "Delivery", nameEs: "Delivery", icon: "bike", spendingNature: "QUIERO" },
    ],
  },
  {
    nameEn: "Housing",
    nameEs: "Vivienda",
    icon: "home",
    color: "#5e54f0",
    type: "EXPENSE",
    spendingNature: "DEBO",
    children: [
      { nameEn: "Rent & Mortgage", nameEs: "Renta / Hipoteca", icon: "home", spendingNature: "DEBO" },
      { nameEn: "Utilities", nameEs: "Servicios básicos", icon: "zap", spendingNature: "NECESITO" },
      { nameEn: "Internet & Phone", nameEs: "Internet y teléfono", icon: "wifi", spendingNature: "NECESITO" },
      { nameEn: "Home Maintenance", nameEs: "Mantenimiento hogar", icon: "wrench", spendingNature: "NECESITO" },
    ],
  },
  {
    nameEn: "Transport",
    nameEs: "Transporte",
    icon: "car",
    color: "#0284c7",
    type: "EXPENSE",
    spendingNature: "NECESITO",
    children: [
      { nameEn: "Fuel", nameEs: "Combustible", icon: "fuel", spendingNature: "NECESITO" },
      { nameEn: "Transit & Rideshare", nameEs: "Transporte público y taxi", icon: "bus", spendingNature: "NECESITO" },
      { nameEn: "Parking & Tolls", nameEs: "Estacionamiento y peajes", icon: "parking-circle", spendingNature: "NECESITO" },
      { nameEn: "Vehicle Maintenance", nameEs: "Mantenimiento vehículo", icon: "wrench", spendingNature: "DEBO" },
    ],
  },
  {
    nameEn: "Health",
    nameEs: "Salud",
    icon: "heart-pulse",
    color: "#10b981",
    type: "EXPENSE",
    spendingNature: "NECESITO",
    children: [
      { nameEn: "Doctor & Pharmacy", nameEs: "Médico y farmacia", icon: "pill", spendingNature: "NECESITO" },
      { nameEn: "Fitness & Gym", nameEs: "Gimnasio y deporte", icon: "dumbbell", spendingNature: "QUIERO" },
      { nameEn: "Personal Care", nameEs: "Cuidado personal", icon: "sparkles", spendingNature: "NECESITO" },
    ],
  },
  {
    nameEn: "Shopping",
    nameEs: "Compras",
    icon: "shopping-bag",
    color: "#ec4899",
    type: "EXPENSE",
    spendingNature: "QUIERO",
    children: [
      { nameEn: "Clothing & Shoes", nameEs: "Ropa y calzado", icon: "shirt", spendingNature: "QUIERO" },
      { nameEn: "Electronics", nameEs: "Tecnología", icon: "smartphone", spendingNature: "QUIERO" },
      { nameEn: "Home Goods", nameEs: "Artículos del hogar", icon: "sofa", spendingNature: "NECESITO" },
    ],
  },
  {
    nameEn: "Entertainment",
    nameEs: "Entretenimiento",
    icon: "clapperboard",
    color: "#8b5cf6",
    type: "EXPENSE",
    spendingNature: "QUIERO",
    children: [
      { nameEn: "Subscriptions", nameEs: "Suscripciones", icon: "tv", spendingNature: "QUIERO" },
      { nameEn: "Outings & Events", nameEs: "Salidas y eventos", icon: "ticket", spendingNature: "QUIERO" },
      { nameEn: "Hobbies & Games", nameEs: "Hobbies y juegos", icon: "gamepad-2", spendingNature: "QUIERO" },
      { nameEn: "Travel", nameEs: "Viajes", icon: "plane", spendingNature: "QUIERO" },
    ],
  },
  {
    nameEn: "Financial & Debt",
    nameEs: "Finanzas y deudas",
    icon: "landmark",
    color: "#ef4444",
    type: "EXPENSE",
    spendingNature: "DEBO",
    children: [
      { nameEn: "Debt Payment", nameEs: "Pago de deuda", icon: "hand-coins", spendingNature: "DEBO" },
      { nameEn: "Insurance", nameEs: "Seguros", icon: "shield", spendingNature: "DEBO" },
      { nameEn: "Fees & Interest", nameEs: "Comisiones e intereses", icon: "percent", spendingNature: "DEBO" },
      { nameEn: "Taxes", nameEs: "Impuestos", icon: "receipt", spendingNature: "DEBO" },
      { nameEn: "Savings & Investments", nameEs: "Ahorro e inversiones", icon: "piggy-bank", spendingNature: "NECESITO" },
    ],
  },
  {
    nameEn: "Family & Personal",
    nameEs: "Familia y personal",
    icon: "gift",
    color: "#eab308",
    type: "EXPENSE",
    spendingNature: "QUIERO",
    children: [
      { nameEn: "Gifts", nameEs: "Regalos", icon: "gift", spendingNature: "QUIERO" },
      { nameEn: "Family Support", nameEs: "Apoyo familiar", icon: "users", spendingNature: "NECESITO" },
      { nameEn: "Kids & Childcare", nameEs: "Hijos y cuidado", icon: "baby", spendingNature: "NECESITO" },
      { nameEn: "Pets", nameEs: "Mascotas", icon: "paw-print", spendingNature: "NECESITO" },
      { nameEn: "Education", nameEs: "Educación", icon: "graduation-cap", spendingNature: "NECESITO" },
      { nameEn: "Donations", nameEs: "Donaciones", icon: "heart-handshake", spendingNature: "QUIERO" },
    ],
  },
  {
    nameEn: "Other",
    nameEs: "Otros gastos",
    icon: "tag",
    color: "#64748b",
    type: "EXPENSE",
    spendingNature: "NECESITO",
  },

  // ── INCOME ────────────────────────────────────────────────────────────
  {
    nameEn: "Salary",
    nameEs: "Salario",
    icon: "briefcase",
    color: "#059669",
    type: "INCOME",
  },
  {
    nameEn: "Business & Freelance",
    nameEs: "Negocio y freelance",
    icon: "laptop",
    color: "#0d9488",
    type: "INCOME",
  },
  {
    nameEn: "Investments & Interest",
    nameEs: "Inversiones e intereses",
    icon: "trending-up",
    color: "#047857",
    type: "INCOME",
  },
  {
    nameEn: "Bonuses & Gifts",
    nameEs: "Bonos y regalos",
    icon: "gift",
    color: "#14b8a6",
    type: "INCOME",
  },
  {
    nameEn: "Sales & Rentals",
    nameEs: "Ventas y alquileres",
    icon: "store",
    color: "#22c55e",
    type: "INCOME",
  },
  {
    nameEn: "Refunds & Cashback",
    nameEs: "Reembolsos y cashback",
    icon: "rotate-ccw",
    color: "#16a34a",
    type: "INCOME",
  },
  {
    nameEn: "Other Income",
    nameEs: "Otros ingresos",
    icon: "plus-circle",
    color: "#10b981",
    type: "INCOME",
  },
];

export type CategorySeedDb =
  | Pick<PrismaClient, "category">
  | Pick<Prisma.TransactionClient, "category">;

export type SeedDefaultCategoriesOptions = {
  createdBy?: string | null;
  categories?: readonly DefaultCategory[];
  /**
   * When false (default), skips seeding if the organization already has any
   * active (`deletedAt: null`) category. Keeps seeding idempotent across
   * retries, hooks, and backfill scripts.
   */
  force?: boolean;
};

export type SeedDefaultCategoriesResult = {
  seeded: boolean;
  parents: number;
  children: number;
};

/**
 * Seeds the canonical bilingual system categories & subcategories for a Space.
 * Uses two batched writes (`createManyAndReturn` + `createMany`) so it stays
 * fast and atomic inside an organization-creation transaction.
 */
export async function seedDefaultCategories(
  tx: CategorySeedDb,
  organizationId: string,
  options: SeedDefaultCategoriesOptions = {},
): Promise<SeedDefaultCategoriesResult> {
  const {
    createdBy = null,
    categories = DEFAULT_SYSTEM_CATEGORIES,
    force = false,
  } = options;

  if (!force) {
    const existing = await tx.category.count({
      where: { organizationId, deletedAt: null },
    });
    if (existing > 0) {
      return { seeded: false, parents: 0, children: 0 };
    }
  }

  if (categories.length === 0) {
    return { seeded: true, parents: 0, children: 0 };
  }

  const createdParents = await tx.category.createManyAndReturn({
    data: categories.map((cat) => ({
      organizationId,
      name: cat.nameEn,
      nameEn: cat.nameEn,
      nameEs: cat.nameEs,
      isSystem: true,
      icon: cat.icon,
      color: cat.color,
      type: cat.type,
      spendingNature:
        cat.type === "EXPENSE" ? (cat.spendingNature ?? "NECESITO") : null,
      createdBy,
    })),
    select: { id: true, name: true },
  });

  const parentIdByName = new Map(createdParents.map((p) => [p.name, p.id]));

  const childRows = categories.flatMap((cat) => {
    const parentId = parentIdByName.get(cat.nameEn);
    if (!parentId || !cat.children?.length) return [];
    return cat.children.map((sub) => ({
      organizationId,
      parentId,
      name: sub.nameEn,
      nameEn: sub.nameEn,
      nameEs: sub.nameEs,
      isSystem: true,
      icon: sub.icon,
      color: cat.color,
      type: cat.type,
      spendingNature:
        cat.type === "EXPENSE"
          ? (sub.spendingNature ?? cat.spendingNature ?? "NECESITO")
          : null,
      createdBy,
    }));
  });

  let childrenCount = 0;
  if (childRows.length > 0) {
    const res = await tx.category.createMany({ data: childRows });
    childrenCount = res.count;
  }

  return {
    seeded: true,
    parents: createdParents.length,
    children: childrenCount,
  };
}

/** Resolve a category's display name for the active locale ("en" | "es"). */
export function localizeCategoryName(
  cat: { name: string; nameEn?: string | null; nameEs?: string | null },
  locale: string,
): string {
  if (locale.startsWith("es")) return cat.nameEs || cat.name;
  return cat.nameEn || cat.name;
}

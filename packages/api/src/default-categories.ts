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
 * Canonical bilingual system categories (EN + ES).
 * Clean, modern hierarchy designed for fast daily entry without bloat.
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
      { nameEn: "Utilities", nameEs: "Servicios (agua, luz)", icon: "zap", spendingNature: "NECESITO" },
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
      { nameEn: "Fuel", nameEs: "Gasolina", icon: "fuel", spendingNature: "NECESITO" },
      { nameEn: "Rideshare & Transit", nameEs: "Uber y transporte", icon: "bus", spendingNature: "NECESITO" },
      { nameEn: "Parking & Tolls", nameEs: "Estacionamiento", icon: "parking-circle", spendingNature: "NECESITO" },
      { nameEn: "Car Maintenance", nameEs: "Mantenimiento auto", icon: "wrench", spendingNature: "DEBO" },
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
      { nameEn: "Clothing", nameEs: "Ropa y calzado", icon: "shirt", spendingNature: "QUIERO" },
      { nameEn: "Electronics", nameEs: "Tecnología", icon: "smartphone", spendingNature: "QUIERO" },
      { nameEn: "Home Goods", nameEs: "Artículos hogar", icon: "sofa", spendingNature: "NECESITO" },
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
      { nameEn: "Travel", nameEs: "Viajes", icon: "plane", spendingNature: "QUIERO" },
    ],
  },
  {
    nameEn: "Financial & Debt",
    nameEs: "Finanzas y deudas",
    icon: "landmark",
    color: "#475569",
    type: "EXPENSE",
    spendingNature: "DEBO",
    children: [
      { nameEn: "Debt Payment", nameEs: "Pago de deuda", icon: "hand-coins", spendingNature: "DEBO" },
      { nameEn: "Insurance", nameEs: "Seguros", icon: "shield", spendingNature: "DEBO" },
      { nameEn: "Fees & Interest", nameEs: "Comisiones e intereses", icon: "percent", spendingNature: "DEBO" },
      { nameEn: "Taxes", nameEs: "Impuestos", icon: "receipt", spendingNature: "DEBO" },
    ],
  },
  {
    nameEn: "Family & Giving",
    nameEs: "Familia y aportes",
    icon: "gift",
    color: "#eab308",
    type: "EXPENSE",
    spendingNature: "QUIERO",
    children: [
      { nameEn: "Gifts", nameEs: "Regalos", icon: "gift", spendingNature: "QUIERO" },
      { nameEn: "Family Support", nameEs: "Apoyo familiar", icon: "users", spendingNature: "NECESITO" },
      { nameEn: "Donations & Tithe", nameEs: "Donaciones y diezmo", icon: "heart-handshake", spendingNature: "DEBO" },
      { nameEn: "Education", nameEs: "Educación", icon: "graduation-cap", spendingNature: "NECESITO" },
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
    nameEn: "Freelance & Business",
    nameEs: "Negocio / Freelance",
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

/** Resolve a category's display name for the active locale ("en" | "es"). */
export function localizeCategoryName(
  cat: { name: string; nameEn?: string | null; nameEs?: string | null },
  locale: string,
): string {
  if (locale.startsWith("es")) return cat.nameEs || cat.name;
  return cat.nameEn || cat.name;
}

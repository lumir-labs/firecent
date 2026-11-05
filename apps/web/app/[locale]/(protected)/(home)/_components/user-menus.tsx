import type { ReactNode } from "react";
import {
  ArrowLeftRight,
  Building2,
  ChartNoAxesColumnIncreasing,
  ChartPie,
  CreditCard,
  House,
  KeyRound,
  Target,
  User,
  Wallet,
} from "lucide-react";
import { p, type PermissionKey } from "@app/api/permissions";

/**
 * Menu for the normal (non-admin) authenticated user's area.
 * Copies the pattern of `admin/_components/menus.tsx` (`getFullMenu` +
 * permission filter), but with its own items. Two categories:
 *
 * - `dashboard`: the whole product in one place (home, transactions,
 *   accounts, budget, goals, analytics). Only `/` exists today: the other
 *   links are deliberately ahead of their pages (they 404 until created).
 * - `account`: what already existed before the dashboard rework (profile,
 *   organization + api-keys, billing), kept together until it gets moved.
 *
 * Area items DON'T require a permission (`requiredPermission` optional):
 * any authenticated session gets in (the guard lives in `(home)/layout.tsx`),
 * except for the organization items: without `organizations:read` /
 * `apikeys:menu` the page shows AccessAlert, so they are hidden from the menu
 * just like admin items. Access to admin sections is listed only on the
 * dashboard and there they ARE filtered by permission.
 * Keep in sync with `packages/lib/src/messages/` → `Nav.menu`.
 */
export type UserMenuTitleKey =
  | "menu.dashboard"
  | "menu.home"
  | "menu.transactions"
  | "menu.accounts"
  | "menu.budget"
  | "menu.goals"
  | "menu.analytics"
  | "menu.account"
  | "menu.profile"
  | "menu.organization"
  | "menu.apiKeys"
  | "menu.billing";

export type UserMenuItem = {
  title: UserMenuTitleKey;
  path: string;
  icon: ReactNode;
  sidebar?: boolean;
  /**
   * Shown as its own tab in the mobile bottom bar (`navlinks-responsive`).
   * A category with no `mobile` item collapses into a single tab (its `path`).
   */
  mobile?: boolean;
  requiredPermission?: PermissionKey;
};

export type UserMenuCategory = {
  title: UserMenuTitleKey;
  icon: ReactNode;
  path?: string;
  sidebar?: boolean;
  items: UserMenuItem[];
};

// Full menu definition for the authenticated area (no permissions: visible to everyone logged in)
export const getFullUserMenu = (): UserMenuCategory[] => [
  {
    title: "menu.dashboard",
    path: "/",
    icon: <House size={18} />,
    items: [
      {
        title: "menu.home",
        path: "/",
        icon: <House size={18} />,
        mobile: true,
      },
      {
        title: "menu.transactions",
        path: "/transactions",
        icon: <ArrowLeftRight size={18} />,
        mobile: true,
      },
      {
        title: "menu.accounts",
        path: "/accounts",
        icon: <Wallet size={18} />,
      },
      {
        title: "menu.budget",
        path: "/budget",
        icon: <ChartPie size={18} />,
      },
      {
        title: "menu.goals",
        path: "/goals",
        icon: <Target size={18} />,
        mobile: true,
      },
      {
        title: "menu.analytics",
        path: "/analytics",
        icon: <ChartNoAxesColumnIncreasing size={18} />,
        mobile: true,
      },
    ],
  },
  {
    title: "menu.account",
    path: "/profile",
    icon: <User size={18} />,
    items: [
      {
        title: "menu.profile",
        path: "/profile",
        icon: <User size={18} />,
      },
      {
        title: "menu.organization",
        path: "/organization",
        icon: <Building2 size={18} />,
        // Org admin section: without `organizations:menu` the page shows
        // AccessAlert, so it is hidden just like admin items.
        requiredPermission: p.organizations.read,
      },
      {
        title: "menu.apiKeys",
        path: "/organization/api-keys",
        icon: <KeyRound size={18} />,
        // Without `apikeys:menu` the page shows AccessAlert (§5.4), so
        // it is hidden from the menu just like admin items.
        requiredPermission: p.apikeys.menu,
      },
      {
        title: "menu.billing",
        path: "/billing",
        icon: <CreditCard size={18} />,
      },
    ],
  },
];

// Same semantics as the admin's `menus.tsx:140-147`: without a required
// permission the item is visible; with one, `includes` is enforced as in the admin.
export function hasUserPermission(
  userPermissions: string[],
  requiredPermission?: PermissionKey,
): boolean {
  if (!requiredPermission) return true;
  return userPermissions.some((permission) =>
    requiredPermission.includes(permission),
  );
}

export default function getUserMenu({
  permissions,
}: {
  permissions: string[];
}) {
  const fullMenu = getFullUserMenu();

  const filteredData = fullMenu
    .map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        hasUserPermission(permissions, item.requiredPermission),
      ),
    }))
    .filter((category) => category.items.length > 0);

  return { categories: filteredData };
}

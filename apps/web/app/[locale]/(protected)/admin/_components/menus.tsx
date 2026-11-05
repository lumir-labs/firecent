import {
  Building05Icon,
  DashboardBrowsingIcon,
  Home,
  PencilRulerIcon,
  ShieldKeyIcon,
  Users,
  UserShieldIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { p, PermissionKey } from "@app/api/permissions";

/**
 * Translation key (`Nav.menu.*`) instead of fixed text: menus are consumed
 * from Client Components, each site resolves with tNav(title).
 * Keep in sync with `packages/lib/src/messages/{es,en}.json` → `Nav.menu`.
 */
export type MenuTitleKey =
  | "menu.general"
  | "menu.dashboard"
  | "menu.portal"
  | "menu.organizations"
  | "menu.manage"
  | "menu.roles"
  | "menu.permissions"
  | "menu.users";

export type Menu = {
  title: MenuTitleKey;
  icon: React.ReactNode;
  path?: string;
  sidebar?: boolean;
  requiredPermission?: PermissionKey;
  isActive?: boolean;
  items: {
    title: MenuTitleKey;
    path: string;
    icon: React.ReactNode;
    sidebar?: boolean;
    notifications?: {
      count: number | undefined;
      isLoading: boolean;
      error: Error | null;
    };
    isActive?: boolean;
    requiredPermission: PermissionKey;
  }[];
};

// Full menu definition with required permissions
export const getFullMenu = (notifications?: {
  audit: {
    count: number | undefined;
    isLoading: boolean;
    error: Error | null;
  };
  project: {
    count: number | undefined;
    isLoading: boolean;
    error: Error | null;
  };
}): Menu[] => [
  {
    title: "menu.general",
    path: "/admin/dashboard",
    icon: <HugeiconsIcon icon={DashboardBrowsingIcon} size={18} />,
    items: [
      {
        title: "menu.dashboard",
        path: "/admin/dashboard",
        icon: <HugeiconsIcon icon={DashboardBrowsingIcon} size={18} />,
        requiredPermission: p.dashboard.basic,
      },
    ],
  },
  {
    title: "menu.portal",
    path: "/admin/organizations",
    icon: <HugeiconsIcon icon={Home} size={18} />,
    items: [
      {
        title: "menu.organizations",
        path: "/admin/organizations",
        icon: <HugeiconsIcon icon={Building05Icon} size={18} />,
        requiredPermission: p.organizations.menu,
        notifications: {
          count: notifications?.audit.count,
          isLoading: notifications?.audit.isLoading || false,
          error: notifications?.audit.error || null,
        },
      },
    ],
  },
  {
    title: "menu.manage",
    icon: <HugeiconsIcon icon={PencilRulerIcon} />,
    path: "/admin",
    items: [
      {
        title: "menu.roles",
        path: "/admin/roles",
        icon: <HugeiconsIcon icon={UserShieldIcon} size={18} />,
        requiredPermission: p.roles.menu,
      },
      {
        title: "menu.permissions",
        path: "/admin/permissions",
        icon: <HugeiconsIcon icon={ShieldKeyIcon} size={18} />,
        requiredPermission: p.permissions.menu,
      },
      {
        title: "menu.users",
        path: "/admin/users",
        icon: <HugeiconsIcon icon={Users} size={18} />,
        requiredPermission: p.users.menu,
      },
    ],
  },
];

export default function getMenu({
  permissions,
  notifications,
}: {
  permissions: string[];
  notifications?: {
    audit: {
      count: number | undefined;
      isLoading: boolean;
      error: Error | null;
    };
    project: {
      count: number | undefined;
      isLoading: boolean;
      error: Error | null;
    };
  };
}) {
  // Function to check whether the user has a specific permission
  function hasPermission(
    userPermissions: string[],
    requiredPermission: PermissionKey,
  ): boolean {
    return userPermissions.some((permission) =>
      requiredPermission.includes(permission),
    );
  }

  const fullMenu = getFullMenu(notifications);

  const filteredData = fullMenu.filter((category) => {
    category.items = category.items.filter((item) => {
      return hasPermission(permissions, item.requiredPermission);
    });
    return category.items.length > 0;
  });

  return { categories: filteredData };
}

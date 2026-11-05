"use server";

import { db, Prisma } from "@app/db";
import { p } from "@app/api/permissions";
import { validatePermission } from "./permissions";

export type DashboardStats = {
  users: number;
  organizations: number;
  roles: number;
  permissions: number;
};

export type RecentOrganization = Prisma.OrganizationGetPayload<{
  select: {
    id: true;
    name: true;
    description: true;
    createdAt: true;
    _count: {
      select: {
        members: true;
      };
    };
  };
}>;

export async function getDashboardStats(): Promise<{
  data?: DashboardStats;
  error?: string;
}> {
  const { hasPermission } = await validatePermission(p.dashboard.basic);
  if (!hasPermission) {
    console.log("[❌getDashboardStats] No permission to view dashboard");
    return { error: "No permission to view dashboard" };
  }

  console.log("[⌛getDashboardStats] Running query");
  try {
    const [users, organizations, roles, permissions] = await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.organization.count({ where: { deletedAt: null } }),
      db.role.count({ where: { deletedAt: null } }),
      db.permission.count({ where: { deletedAt: null } }),
    ]);
    console.log("[✅getDashboardStats] Stats fetched successfully");
    return { data: { users, organizations, roles, permissions } };
  } catch (error) {
    console.log(`[❌getDashboardStats] Error fetching stats: ${error}`);
    return { error: "Error fetching the statistics" };
  }
}

export async function listRecentOrganizations(): Promise<{
  data?: RecentOrganization[];
  error?: string;
}> {
  const { hasPermission } = await validatePermission(p.dashboard.basic);
  if (!hasPermission) {
    console.log("[❌listRecentOrganizations] No permission to view dashboard");
    return { data: [], error: "No permission to view dashboard" };
  }

  console.log("[⌛listRecentOrganizations] Running query");
  try {
    const itemsList = await db.organization.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
          },
        },
      },
    });
    console.log(
      `[✅listRecentOrganizations] ${itemsList.length} Organizations fetched successfully`,
    );
    return { data: itemsList };
  } catch (error) {
    console.log(
      `[❌listRecentOrganizations] Error listing recent organizations: ${error}`,
    );
    return { error: "Error listing recent organizations" };
  }
}

"use server";

import { db, Prisma } from "@app/db";
import { auth, getServerSession } from "../auth";
import { headers } from "next/headers";
import { validate } from "./validations";
import { validatePermission } from "./permissions";
import { p } from "@app/api/permissions";
import type { GetCurrentOrganizationResult } from "@app/lib";
import { resolveActiveOrg } from "./org-guard";

export type Organization = Prisma.OrganizationGetPayload<{
  select: {
    id: true;
    name: true;
    description: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

/**
 * Catalog of organizations visible to the caller (no longer public).
 * - With `organizations:list` → all of them (admin).
 * - Without the permission → only those where the user is a member (selects, onboarding).
 * No session → `{ error }`.
 */
export async function listOrganizations(): Promise<{
  data?: Organization[];
  error?: string;
}> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return { error: "You don't have permission to perform this action" };
    }
    const { hasPermission } = await validatePermission(p.organizations.list);
    const where = hasPermission
      ? {}
      : { members: { some: { userId: session.user.id } } };
    const organizations = await db.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { data: organizations };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error fetching organizations:", error);
      return { error: error.message };
    }
    return { error: "Unknown error fetching organizations" };
  }
}

export async function createOrganization(
  name: string,
  description?: string,
): Promise<{ data?: Organization; error?: string }> {
  //* VALIDATE SESSION
  const result = await validate(p.organizations.create);
  if (!result.success || !result.session?.user?.id) {
    return { data: undefined, error: result.success ? "No valid session" : result.error };
  }
  const userId = result.session.user.id;
  try {
    const organization = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name,
          description,
        },
      });
      await tx.member.create({
        data: {
          organizationId: org.id,
          userId,
          role: "owner",
        },
      });
      return org;
    });
    return { data: organization };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating organization:", error);
      return { error: error.message };
    }
    return { error: "Unknown error creating organization" };
  }
}

export async function adminCreateOrganization(
  name: string,
  description?: string,
): Promise<{ data?: Organization; error?: string }> {
  //* VALIDATE SESSION
  const result = await validatePermission(p.organizations.create);
  if (!result.hasPermission || !result.session?.user?.id) {
    return { data: undefined, error: result.hasPermission ? "No valid session" : result.error };
  }
  const userId = result.session.user.id;
  try {
    const organization = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name,
          description,
        },
      });
      await tx.member.create({
        data: {
          organizationId: org.id,
          userId,
          role: "owner",
        },
      });
      return org;
    });
    return { data: organization };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating organization:", error);
      return { error: error.message };
    }
    return { error: "Unknown error creating organization" };
  }
}

export async function createOrganizationOnboarding(
  name: string,
  description?: string,
): Promise<{ data?: Organization; error?: string }> {
  //* VALIDATE SESSION (no organization yet - onboarding flow)
  const session = await getServerSession();
  if (!session?.user?.email) {
    return {
      data: undefined,
      error: "You don't have permission to perform this action",
    };
  }

  try {
    //* CREATE BASE ORGANIZATION IN TRANSACTION
    const organization = await db.$transaction(async (tx) => {
      // 1. Create the organization
      const org = await tx.organization.create({
        data: {
          name,
          description,
        },
      });

      // 2. Create the owner member
      await tx.member.create({
        data: {
          organizationId: org.id,
          userId: session.user.id,
          role: "owner",
        },
      });

      // 3. Mark the user as onboarded
      await tx.user.update({
        where: { email: session.user.email },
        data: {
          isOnboarded: true,
        },
      });

      return org;
    });

    // Active-org write path: the `organization` plugin's session carries
    // `activeOrganizationId` and `getSessionOrganization()` respects it.
    // Non-fatal: if the set fails, the fallback to memberships[0] still works.
    try {
      await auth.api.setActiveOrganization({
        headers: await headers(),
        body: { organizationId: organization.id },
      });
    } catch (error) {
      console.error(
        "[createOrganizationOnboarding] could not set the active org",
        organization.id,
      );
    }

    return { data: organization };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error creating organization:", error);
      return { error: error.message };
    }
    return { error: "Unknown error creating organization" };
  }
}

export async function updateOrganization({
  prop,
  value,
  id,
}: {
  prop: keyof Organization;
  value: string;
  id: string;
}): Promise<{ success?: string; error?: string }> {
  console.log("[⌛updateOrganization] Updating organization");
  const { hasPermission, session } = await validatePermission(p.organizations.update);
  if (!hasPermission || !session) {
    console.log("[❌updateOrganization] No permission to update organizations");
    return { error: "No permission to update organizations" };
  }
  const ALLOWED_PROPS = ["name", "description"] as const;
  if (!ALLOWED_PROPS.includes(prop as any)) {
    return { error: "Field not allowed in organization update" };
  }
  try {
    const rootRole = await db.role.findUnique({
      where: { name: "root" },
      select: { id: true },
    });
    const isRoot = rootRole
      ? session.user.roles.some((r) => Number(r) === rootRole.id)
      : false;

    if (!isRoot) {
      const membership = await db.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId: id,
            userId: session.user.id,
          },
        },
        select: { role: true },
      });
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return { error: "You don't have permission to update this organization" };
      }
    }

    await db.organization.update({
      where: {
        id: id,
      },
      data: {
        [prop]: value,
      },
    });
    console.log("[✅updateOrganization] Organization updated successfully");
    return { success: "Organization updated successfully" };
  } catch (error) {
    console.log(`[❌updateOrganization] Error updating organization: ${error}`);
    return { error: "Error updating organization" };
  }
}

export async function deleteOrganization(
  id: string,
): Promise<{ success?: string; error?: string }> {
  console.log("[⌛deleteOrganization] Deleting organization");
  const { hasPermission } = await validatePermission(p.organizations.delete);
  if (!hasPermission) {
    console.log("[❌deleteOrganization] No permission to delete organizations");
    return { error: "No permission to delete organizations" };
  }
  try {
    const [membersCount, invitationsCount] = await Promise.all([
      db.member.count({ where: { organizationId: id } }),
      db.invitation.count({ where: { organizationId: id } }),
    ]);
    if (membersCount > 0 || invitationsCount > 0) {
      console.log(
        "[❌deleteOrganization] Organization has members or invitations",
      );
      return {
        error: "Cannot delete an organization with members or invitations",
      };
    }
    await db.organization.delete({
      where: {
        id: id,
      },
    });
    console.log("[✅deleteOrganization] Organization deleted successfully");
    return { success: "Organization deleted successfully" };
  } catch (error) {
    console.log(`[❌deleteOrganization] Error deleting organization: ${error}`);
    return { error: "Error deleting organization" };
  }
}

/**
 * Orgs where the session user is a MEMBER (for the header switcher).
 * Unlike `listOrganizations` (catalog by permission), this lists
 * memberships: the only thing `setActiveOrganization` can switch to.
 */
export async function listMyOrganizations(): Promise<{
  data?: { id: string; name: string }[];
  error?: string;
}> {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { error: "You don't have permission to perform this action" };
    }
    const members = await db.member.findMany({
      where: { userId: session.user.id },
      select: { organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return { data: members.map((m) => m.organization) };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("[listMyOrganizations] error");
      return { error: "Unknown error fetching organizations" };
    }
    return { error: "Unknown error fetching organizations" };
  }
}

export async function getSessionOrganization(): Promise<{
  OrganizationId?: string;
  error?: string;
}> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return { error: "You don't have permission to perform this action" };
    }
    const activeId =
      (session.session as { activeOrganizationId?: string | null })
        ?.activeOrganizationId ??
      (session.user as { activeOrganizationId?: string | null })
        ?.activeOrganizationId ??
      null;
    const organization = await db.user.findUnique({
      where: {
        email: session.user.email,
      },
      select: {
        memberships: {
          select: {
            organizationId: true,
          },
        },
      },
    });
    const membershipIds: string[] =
      organization?.memberships?.map((m) => m.organizationId) ?? [];
    const orgId: string | undefined = resolveActiveOrg(
      membershipIds,
      activeId,
    );

    if (!orgId) {
      return { OrganizationId: undefined };
    }

    return { OrganizationId: orgId };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error fetching organization:", error);
      return { error: error.message };
    }
    return { error: "Unknown error fetching organization" };
  }
}

export async function getCurrentOrganization(): Promise<GetCurrentOrganizationResult> {
  //* VALIDATE SESSION
  const result = await validate(p.organizations.read);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  //* RUN QUERY
  try {
    const organizationData = await db.organization.findUnique({
      where: {
        id: result.orgId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!organizationData) {
      return { success: false, error: "Organization not found" };
    }
    return { success: true, data: organizationData };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error fetching organization:", error);
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Unknown error fetching organization",
    };
  }
}

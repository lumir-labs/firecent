"use server";

import { db, Prisma } from "@app/db";
import { validatePermission } from "./permissions";
import { getSessionOrganization } from "./organization";
import { p } from "@app/api/permissions";

export type OrganizationMember = Prisma.MemberGetPayload<{
  select: {
    id: true;
    role: true;
    user: {
      select: {
        id: true;
        name: true;
        email: true;
        image: true;
        createdAt: true;
        updatedAt: true;
      };
    };
  };
}>;

export async function listOrganizationMembers(): Promise<{
  data?: OrganizationMember[];
  error?: string;
}> {
  //* VALIDATE SESSION
  const { hasPermission } = await validatePermission(
    p.organizationMembers.list,
  );
  if (!hasPermission) {
    console.log(
      "[❌listOrganizationMembers] You don't have permission to perform this action",
    );
    return { data: [], error: "You don't have permission to perform this action" };
  }

  //* VALIDATE ORGANIZATION
  const organization = await getSessionOrganization();

  if (!organization || !organization.OrganizationId) {
    console.log(
      "[❌listOrganizationMembers] You don't have permission to perform this action",
    );
    return { data: [], error: "You don't have permission to perform this action" };
  }

  //* RUN QUERY
  console.log("[⌛listOrganizationMembers] Running query");
  try {
    const itemsList: OrganizationMember[] = await db.member.findMany({
      where: {
        organizationId: organization.OrganizationId,
      },
      select: {
        id: true,
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    console.log(
      `[✅listOrganizationMembers] ${itemsList.length} Organization members fetched successfully`,
    );
    return { data: itemsList };
  } catch (error) {
    console.log(
      `[❌listOrganizationMembers] Error listing organization members: ${error}`,
    );
    return { error: "Error listing organization members" };
  }
}

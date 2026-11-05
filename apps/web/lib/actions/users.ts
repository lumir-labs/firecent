"use server";

import { db, Prisma } from "@app/db";
import { auth } from "../auth";
import { validatePermission } from "./permissions";
import { headers } from "next/headers";
import { p } from "@app/api/permissions";
import { isUserUpdateAllowed } from "./user-update-guard";
import { ROLE_ROOT } from "@app/api/roles";

export type User = Prisma.UserGetPayload<{
  select: {
    id: true;
    name: true;
    firstName: true;
    middleName: true;
    lastName: true;
    lastName2: true;
    email: true;
    roles: true;
    image: true;
    emailVerified: true;
    pwdReset: true;
    createdAt: true;
    memberships: {
      select: {
        organization: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
    updatedAt: true;
  };
}>;

export async function getServerSession() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function listUsers() {
  console.log("Reading User List");
  const { hasPermission } = await validatePermission(p.users.read);
  if (!hasPermission) {
    console.log("You don't have permission to read users");
    return { error: "You don't have permission to read users" };
  }
  try {
    const users = await db.user.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        middleName: true,
        lastName: true,
        lastName2: true,
        email: true,
        roles: true,
        image: true,
        emailVerified: true,
        pwdReset: true,
        createdAt: true,
        memberships: {
          select: {
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        updatedAt: true,
      },
    });
    console.log("Users read:", users.length);
    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    return { error: "Error fetching users" };
  }
}

export async function getUser(id: string) {
  const { hasPermission } = await validatePermission(p.users.read);
  if (!hasPermission) {
    return { error: "You don't have permission to read users" };
  }
  try {
    const user = await db.user.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        image: true,
        emailVerified: true,
        pwdReset: true,
      },
    });
    return user;
  } catch (error) {
    console.error("Error fetching user:", error);
    return { error: "Error fetching user" };
  }
}

export async function updateUser({
  data,
  id,
}: {
  data: Prisma.UserUpdateInput;
  id: string;
}) {
  console.log("Updating User");
  const { hasPermission, session } = await validatePermission(p.users.update);
  if (!hasPermission || !session) {
    console.log("You don't have permission to update users");
    return { error: "You don't have permission to update users" };
  }
  if (!isUserUpdateAllowed(data as Record<string, unknown>)) {
    return { error: "Fields not allowed in user update" };
  }

  // Privilege escalation guards
  if (data.roles) {
    if (session.user.id === id) {
      return { error: "You cannot modify your own roles" };
    }
    if (!session.user.permissions.includes(p.roles.update.key)) {
      return { error: "You don't have permission to modify user roles" };
    }

    const rootRole = await db.role.findUnique({
      where: { name: ROLE_ROOT },
      select: { id: true },
    });
    const callerIsRoot = rootRole
      ? session.user.roles.some((r) => Number(r) === rootRole.id)
      : false;

    const targetUser = await db.user.findUnique({
      where: { id },
      select: { roles: { select: { id: true, name: true } } },
    });
    const targetIsRoot = targetUser?.roles.some((r) => r.name === ROLE_ROOT);

    if (targetIsRoot && !callerIsRoot) {
      return { error: "Only root users can modify root users" };
    }

    if (rootRole) {
      const payloadStr = JSON.stringify(data.roles);
      if (payloadStr.includes(String(rootRole.id)) && !callerIsRoot) {
        return { error: "Only root users can assign the root role" };
      }
    }
  }

  if (data.memberships) {
    if (
      !session.user.permissions.includes(p.organizationMembers.create.key) &&
      !session.user.permissions.includes(p.organizations.update.key)
    ) {
      return { error: "You don't have permission to modify user memberships" };
    }
  }
  try {
    await db.user.update({
      where: {
        id: id,
      },
      data,
    });
    console.log("User updated successfully");
    return { success: "User updated successfully" };
  } catch (error) {
    console.error("Error updating user:", error);
    return { error: "Error updating user" };
  }
}

export async function deleteUser(id: string) {
  console.log("Deleting User");
  const { hasPermission } = await validatePermission(p.users.delete);
  if (!hasPermission) {
    console.log("You don't have permission to delete users");
    return { error: "You don't have permission to delete users" };
  }
  try {
    const session = await getServerSession();
    if (session?.user?.id === id) {
      console.log("You cannot delete your own account");
      return { error: "You cannot delete your own account" };
    }
    // Revoke the user's active sessions BEFORE the soft-delete: without this
    // a soft-deleted user stayed logged in (zombie sessions).
    await db.session.deleteMany({ where: { userId: id } });
    await db.user.update({
      where: {
        id: id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
    console.log("User deleted successfully");
    return { success: "User deleted successfully" };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { error: "Error deleting user" };
  }
}

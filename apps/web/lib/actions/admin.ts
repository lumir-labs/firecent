"use server";

import { cookies } from "next/headers";
import { validatePermission } from "./permissions";
import { p } from "@app/api/permissions";

//#region ===================== VIEW AS ==========================================

export async function createViewAsCookie(roleId: string) {
  const { hasPermission } = await validatePermission(p.roles.view_as);
  if (!hasPermission) {
    return { error: "You don't have permission to view as role" };
  }

  const cookieStore = await cookies();
  const name = "viewAs_role";
  const value = roleId;

  cookieStore.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 3600, // 1 hour
    path: "/",
  });
  return {};
}

export async function deleteViewAsCookie() {
  const cookieStore = await cookies();
  const name = "viewAs_role";
  cookieStore.delete(name);
  return {};
}

//#endregion

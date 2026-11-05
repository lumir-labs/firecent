"use server";

import { db } from "@app/db";
import { getServerSession } from "../auth";

export type OwnProfileInput = {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  lastName2?: string | null;
};

/**
 * Updates the session user's own profile.
 * Doesn't require the `users:update` permission (that one is for editing
 * others): the scope is always the session's `id`, never an id received from
 * the client. Only name fields are allowed; email is read-only (no
 * re-verification flow today).
 */
export async function updateOwnProfile(
  data: OwnProfileInput,
): Promise<{ success?: string; error?: string }> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }
  const allowed: OwnProfileInput = {
    firstName: data.firstName ?? null,
    middleName: data.middleName ?? null,
    lastName: data.lastName ?? null,
    lastName2: data.lastName2 ?? null,
  };
  try {
    await db.user.update({
      where: { id: session.user.id },
      data: allowed,
    });
    return { success: "Profile updated successfully" };
  } catch (error) {
    console.error("[❌updateOwnProfile] Error updating profile:", error);
    return { error: "Error updating profile" };
  }
}

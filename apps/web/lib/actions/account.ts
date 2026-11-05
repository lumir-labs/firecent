"use server";

import { db } from "@app/db";
import { getServerSession } from "../auth";
import { anonymizeAndDeleteUser } from "./account-core";

/**
 * Real DSR (data subject rights):
 * - `exportMyData`: Art. 15 / CCPA "know" — own profile + orgs + key
 *   metadata (never secrets).
 * - `deleteMyAccount`: anonymizes the row (frees the unique email) + revokes
 *   sessions/accounts/memberships/sent invitations/api keys/roles/
 *   verifications in ONE transaction (core in `account-core.ts`, tested
 *   against a real DB). The UI must call `authClient.signOut()` afterwards.
 *   Backups/retention/logs remain the HOST's responsibility (README).
 */
export async function exportMyData() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return { error: "You don't have permission to perform this action" };
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      middleName: true,
      lastName: true,
      lastName2: true,
      image: true,
      emailVerified: true,
      createdAt: true,
      memberships: {
        select: {
          role: true,
          organization: {
            select: { id: true, name: true, description: true },
          },
        },
      },
      createdApiKeys: {
        select: {
          id: true,
          name: true,
          prefix: true,
          scopes: true,
          createdAt: true,
          revokedAt: true,
        },
      },
    },
  });
  if (!user) return { error: "User not found" };
  // Minimal audit without PII (userId only): the host can see who exported and when.
  console.info("[dsr] exportMyData", { userId: session.user.id });
  return { data: user };
}

export async function deleteMyAccount(): Promise<{
  success?: string;
  error?: string;
}> {
  const session = await getServerSession();
  if (!session?.user?.id || !session.user.email) {
    return { error: "You don't have permission to perform this action" };
  }
  try {
    await anonymizeAndDeleteUser(session.user.id, session.user.email);
    console.info("[dsr] deleteMyAccount", { userId: session.user.id });
    return { success: "Account deleted" };
  } catch (error) {
    console.error("[dsr] deleteMyAccount failed");
    void error;
    return { error: "Could not delete the account" };
  }
}

import { randomUUID } from "node:crypto";
import { db } from "@app/db";

/**
 * Account deletion core (DSR). Lives OUTSIDE "use server" on purpose:
 * it is consumed by the server action `deleteMyAccount` (apps/web/lib/actions/account.ts)
 * and the integration test `account-core.test.mjs` against a real DB.
 *
 * ANONYMIZE + PURGE strategy (no User row delete):
 * - Keeps the row for referential integrity (ApiKey.createdBy RESTRICT) and
 *   audit forensics, but frees the unique `email` → the same email can
 *   sign up again cleanly.
 * - Revokes ALL access: sessions, OAuth accounts, memberships,
 *   sent invitations, created API keys, email verifications, and roles.
 *
 * Pending on the HOST (documented in the README): backups/retention and logs.
 */
export const DELETED_EMAIL_DOMAIN = "deleted.local";

export function anonymizedEmail(): string {
  return `deleted_${randomUUID()}@${DELETED_EMAIL_DOMAIN}`;
}

export type AnonymizedUser = {
  id: string;
  email: string;
  // Prisma types the column as nullable; the transaction always sets it.
  deletedAt: Date | null;
};

export async function anonymizeAndDeleteUser(
  userId: string,
  email: string,
): Promise<AnonymizedUser> {
  return db.$transaction(async (tx) => {
    // 1) Revoke active access.
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    // 2) Leave organizations (Member cascades, but the user row is NOT
    //    deleted: memberships must be removed by hand).
    await tx.member.deleteMany({ where: { userId } });
    // 3) Invitations SENT by the user die with them.
    await tx.invitation.deleteMany({ where: { inviterId: userId } });
    // 4) API keys created by the user: no user, no keys (permanently revokes
    //    the MCP access of their keys).
    await tx.apiKey.deleteMany({ where: { createdById: userId } });
    // 5) Email verifications BEFORE anonymizing (the identifier is the
    //    old email).
    await tx.verification.deleteMany({ where: { identifier: email } });
    // 6) Disconnect roles (the m2m relation isn't touched by the update below).
    await tx.user.update({ where: { id: userId }, data: { roles: { set: [] } } });
    // 7) Purge the user's security material: TOTP secret + backup
    //    codes + 2FA flag (without this the anonymized row keeps 2FA enabled).
    await tx.twoFactor.deleteMany({ where: { userId } });
    // 8) Anonymize the row (frees the unique email).
    return tx.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail(),
        name: null,
        firstName: null,
        middleName: null,
        lastName: null,
        lastName2: null,
        image: null,
        emailVerified: false,
        isOnboarded: false,
        pwdReset: false,
        twoFactorEnabled: false,
        deletedAt: new Date(),
      },
      select: { id: true, email: true, deletedAt: true },
    });
  });
}

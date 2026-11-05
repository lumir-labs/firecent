import { z } from "zod";

/**
 * Pure invitation helpers. This module intentionally has NO `"use server"`
 * directive: Next.js requires every export of a `"use server"` module to be
 * an async function, so sync helpers must live here. Server actions import
 * from here (`./invitations`) and client components import from here
 * directly (`invite-form.tsx`, `invitations-card.tsx`).
 */

// Invitation roles: free-form Member string, limited to these three in the UI.
export const INVITE_ROLES = ["member", "admin", "owner"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

const inviteInputSchema = z.object({
  email: z.email("Invalid email").trim().toLowerCase(),
  role: z.enum(INVITE_ROLES),
});

export function parseInviteInput(input: {
  email: string;
  role: string;
}): { ok: true; data: { email: string; role: InviteRole } } | { ok: false } {
  const parsed = inviteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  return { ok: true, data: parsed.data };
}

// Prisma P2002 on @@unique([organizationId, userId]): the email is already a member.
export function isDuplicateMemberError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2002";
}

export type InvitationStatus = "pending" | "accepted" | "canceled" | "expired";

export function invitationStatusOf(inv: {
  status: string;
  expiresAt: Date | string;
}): InvitationStatus {
  if (inv.status === "accepted") return "accepted";
  // The plugin uses "canceled"; "rejected" is the invitee's state when
  // rejecting — both are terminal, labeled the same in the table.
  if (
    inv.status === "canceled" ||
    inv.status === "cancelled" ||
    inv.status === "rejected"
  ) {
    return "canceled";
  }
  if (new Date(inv.expiresAt).getTime() <= Date.now()) return "expired";
  return "pending";
}

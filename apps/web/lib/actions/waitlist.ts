"use server";

import z from "zod";
import { db } from "@app/db";
import { p } from "@app/api/permissions";
import { validatePermission } from "./permissions";

export type WaitlistEntry = {
  id: number;
  email: string;
  createdAt: Date;
};

const emailSchema = z.email().max(254);

/** Active (not soft-deleted) waitlist entries, newest first. Gate `waitlist:menu`. */
export async function listWaitlist(): Promise<{
  data?: WaitlistEntry[];
  error?: string;
}> {
  const { hasPermission } = await validatePermission(p.waitlist.menu);
  if (!hasPermission) {
    return { error: "No permission to read the waitlist" };
  }
  try {
    const data = await db.waitlist.findMany({
      where: { deletedAt: null },
      select: { id: true, email: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { data };
  } catch (error) {
    console.error("[❌listWaitlist]", error);
    return { error: "Error loading the waitlist" };
  }
}

/**
 * Adds an email manually. Gate `waitlist:create`.
 * The email is unique: an active one is rejected; a soft-deleted one is
 * restored (back to the list with a fresh `createdAt`).
 */
export async function createWaitlistEntry(
  rawEmail: string,
): Promise<{ data?: WaitlistEntry; error?: string }> {
  const { hasPermission, session } = await validatePermission(p.waitlist.create);
  if (!hasPermission) {
    return { error: "No permission to add to the waitlist" };
  }
  const parsed = emailSchema.safeParse(String(rawEmail ?? "").trim().toLowerCase());
  if (!parsed.success) {
    return { error: "Invalid email" };
  }
  const email = parsed.data;
  const select = { id: true, email: true, createdAt: true } as const;

  try {
    const existing = await db.waitlist.findUnique({
      where: { email },
      select: { id: true, deletedAt: true },
    });
    if (existing && !existing.deletedAt) {
      return { error: "This email is already on the waitlist" };
    }
    const data = existing
      ? await db.waitlist.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            deletedBy: null,
            createdAt: new Date(),
            createdBy: session?.user?.id ?? null,
          },
          select,
        })
      : await db.waitlist.create({
          data: { email, createdBy: session?.user?.id ?? null },
          select,
        });
    return { data };
  } catch (error) {
    console.error("[❌createWaitlistEntry]", error);
    return { error: "Error adding to the waitlist" };
  }
}

/** Soft delete (`deletedAt` + `deletedBy`). Gate `waitlist:delete`. */
export async function deleteWaitlistEntry(
  id: number,
): Promise<{ success?: string; error?: string }> {
  const { hasPermission, session } = await validatePermission(p.waitlist.delete);
  if (!hasPermission) {
    return { error: "No permission to delete from the waitlist" };
  }
  try {
    const { count } = await db.waitlist.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy: session?.user?.id ?? null },
    });
    if (count === 0) return { error: "Entry not found" };
    return { success: "Removed from the waitlist" };
  } catch (error) {
    console.error("[❌deleteWaitlistEntry]", error);
    return { error: "Error removing from the waitlist" };
  }
}

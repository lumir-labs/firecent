import { z } from "zod";

/**
 * Editing the user's OWN profile via tRPC (web + mobile share this contract).
 * `image` exceeds the plan's "names only" whitelist: the avatar URL is
 * included by decision (own data, no escalation risk) for the app's future
 * picker. `.strict()`: any key outside this whitelist (email, emailVerified,
 * deletedAt, roles…) fails parsing — defense-in-depth together with the
 * admin Server Actions guard (`user-update-guard.ts`).
 */
export const updateOwnSchema = z
  .object({
    name: z.string().trim().min(1).max(128).optional(),
    firstName: z.string().trim().min(1).max(64).optional(),
    middleName: z.string().trim().min(1).max(64).optional(),
    lastName: z.string().trim().min(1).max(64).optional(),
    lastName2: z.string().trim().min(1).max(64).optional(),
    image: z.string().trim().url().max(512).optional(),
  })
  .strict();

export type UpdateOwnInput = z.infer<typeof updateOwnSchema>;

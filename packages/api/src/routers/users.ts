import { TRPCError } from "@trpc/server";
import { db } from "@app/db";
import { protectedProcedure, router } from "../trpc";
import { updateOwnSchema } from "../users/schemas";

// Own profile: no emailVerified/pwdReset/deletedAt — the client does not
// need them and they must not leave through tRPC.
const ownProfileSelect = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  middleName: true,
  lastName: true,
  lastName2: true,
  image: true,
} as const;

/**
 * `users` router (data shared web↔mobile — rule from `docs/TRPC.md`):
 * - `getOwn`: the session user's profile.
 * - `updateOwn`: edits ONLY the own profile with a strict whitelist
 *   (`updateOwnSchema`). No `requirePermission`: own data, not admin.
 * Both filter by `ctx.session.user.id` — touching another user is impossible.
 */
export const usersRouter = router({
  getOwn: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user.id;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return db.user.findUnique({
      where: { id: userId },
      select: ownProfileSelect,
    });
  }),

  updateOwn: protectedProcedure
    .input(updateOwnSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return db.user.update({
        where: { id: userId },
        data: input,
        select: ownProfileSelect,
      });
    }),
});

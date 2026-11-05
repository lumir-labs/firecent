import { protectedProcedure, router } from "./trpc";
import { healthRouter } from "./routers/health";
import { usersRouter } from "./routers/users";

export const appRouter = router({
  health: healthRouter,
  users: usersRouter,
  me: protectedProcedure.query(async ({ ctx }) => {
    return {
      user: ctx.session?.user,
      session: ctx.session?.session,
      orgId: ctx.orgId,
    };
  }),
});

export type AppRouter = typeof appRouter;

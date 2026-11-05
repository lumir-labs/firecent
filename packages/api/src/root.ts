import { protectedProcedure, router } from "./trpc";
import { dashboardRouter } from "./routers/dashboard";
import { healthRouter } from "./routers/health";
import { recordsRouter } from "./routers/records";
import { usersRouter } from "./routers/users";

export const appRouter = router({
  dashboard: dashboardRouter,
  health: healthRouter,
  records: recordsRouter,
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

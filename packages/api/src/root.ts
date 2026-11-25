import { protectedProcedure, router } from "./trpc";
import { accountsRouter } from "./routers/accounts";
import { analyticsRouter } from "./routers/analytics";
import { assistantRouter } from "./routers/assistant";
import { budgetsRouter } from "./routers/budgets";
import { categoriesRouter } from "./routers/categories";
import { dashboardRouter } from "./routers/dashboard";
import { debtsRouter } from "./routers/debts";
import { healthRouter } from "./routers/health";
import { labelsRouter } from "./routers/labels";
import { notificationsRouter } from "./routers/notifications";
import { recordsRouter } from "./routers/records";
import { recurringRouter } from "./routers/recurring";
import { usersRouter } from "./routers/users";

export const appRouter = router({
  accounts: accountsRouter,
  analytics: analyticsRouter,
  assistant: assistantRouter,
  budgets: budgetsRouter,
  categories: categoriesRouter,
  dashboard: dashboardRouter,
  debts: debtsRouter,
  health: healthRouter,
  labels: labelsRouter,
  notifications: notificationsRouter,
  records: recordsRouter,
  recurring: recurringRouter,
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

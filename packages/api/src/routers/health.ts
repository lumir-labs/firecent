import { publicProcedure, router } from "../trpc";

export const healthRouter = router({
  check: publicProcedure.query(() => ({
    ok: true,
    service: "app",
    time: new Date().toISOString(),
  })),
  ping: publicProcedure.query(() => "pong"),
});

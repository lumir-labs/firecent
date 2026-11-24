import { TRPCError } from "@trpc/server";
import z from "zod";
import { db } from "@app/db";
import { p } from "../permissions";
import { protectedProcedure, requirePermission, router } from "../trpc";

function requireOrg(orgId: string | null): string {
  if (!orgId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active organization",
    });
  }
  return orgId;
}

export const labelsRouter = router({
  list: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .query(async ({ ctx }) => {
      const orgId = requireOrg(ctx.orgId);
      return db.label.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: { id: true, name: true, color: true },
        orderBy: { name: "asc" },
      });
    }),

  create: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        name: z.string().trim().min(1).max(40),
        color: z.string().trim().max(24).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const existing = await db.label.findFirst({
        where: {
          organizationId: orgId,
          name: { equals: input.name, mode: "insensitive" },
          deletedAt: null,
        },
        select: { id: true, name: true, color: true },
      });
      if (existing) return existing;

      return db.label.create({
        data: {
          organizationId: orgId,
          name: input.name,
          color: input.color ?? "BLUE",
          createdBy: userId,
        },
        select: { id: true, name: true, color: true },
      });
    }),
});

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

export const categoriesRouter = router({
  list: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z
        .object({
          type: z.enum(["EXPENSE", "INCOME"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      return db.category.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          hidden: false,
          ...(input?.type ? { type: input.type } : {}),
        },
        select: {
          id: true,
          name: true,
          icon: true,
          color: true,
          type: true,
          spendingNature: true,
          parentId: true,
        },
        orderBy: { name: "asc" },
      });
    }),
});

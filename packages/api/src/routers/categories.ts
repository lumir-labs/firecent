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
          nameEn: true,
          nameEs: true,
          isSystem: true,
          icon: true,
          color: true,
          type: true,
          spendingNature: true,
          parentId: true,
          _count: {
            select: {
              records: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: [{ parentId: "asc" }, { name: "asc" }],
      });
    }),

  /** User-created custom category (single name in the user's own language). */
  create: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        name: z.string().trim().min(1).max(60),
        type: z.enum(["EXPENSE", "INCOME"]).default("EXPENSE"),
        parentId: z.number().int().positive().nullish(),
        icon: z.string().trim().max(40).nullish(),
        color: z.string().trim().max(32).nullish(),
        spendingNature: z.enum(["DEBO", "NECESITO", "QUIERO"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);
      const userId = ctx.session?.user.id ?? null;

      const existing = await db.category.findFirst({
        where: {
          organizationId: orgId,
          deletedAt: null,
          name: { equals: input.name, mode: "insensitive" },
        },
        select: { id: true, name: true, nameEn: true, nameEs: true, icon: true, color: true, type: true, parentId: true },
      });
      if (existing) return existing;

      let inheritedNature = input.spendingNature ?? "NECESITO";
      let inheritedColor = input.color ?? null;
      let inheritedIcon = input.icon ?? "tag";

      if (input.parentId) {
        const parent = await db.category.findFirst({
          where: { id: input.parentId, organizationId: orgId, deletedAt: null },
          select: { id: true, spendingNature: true, color: true, icon: true },
        });
        if (!parent) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid parent category" });
        }
        inheritedNature = input.spendingNature ?? parent.spendingNature ?? "NECESITO";
        inheritedColor = input.color ?? parent.color;
        inheritedIcon = input.icon ?? parent.icon ?? "tag";
      }

      return db.category.create({
        data: {
          organizationId: orgId,
          name: input.name,
          isSystem: false,
          type: input.type,
          parentId: input.parentId ?? null,
          icon: inheritedIcon,
          color: inheritedColor,
          spendingNature: input.type === "EXPENSE" ? inheritedNature : null,
          createdBy: userId,
        },
        select: {
          id: true,
          name: true,
          nameEn: true,
          nameEs: true,
          icon: true,
          color: true,
          type: true,
          parentId: true,
        },
      });
    }),

  update: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(60).optional(),
        parentId: z.number().int().positive().nullish(),
        icon: z.string().trim().max(40).nullish(),
        color: z.string().trim().max(32).nullish(),
        spendingNature: z.enum(["DEBO", "NECESITO", "QUIERO"]).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);

      const current = await db.category.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        select: {
          id: true,
          name: true,
          nameEn: true,
          nameEs: true,
          isSystem: true,
          type: true,
          parentId: true,
        },
      });
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      if (input.parentId !== undefined && input.parentId !== null) {
        if (input.parentId === current.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Category cannot be its own parent",
          });
        }
        const parent = await db.category.findFirst({
          where: {
            id: input.parentId,
            organizationId: orgId,
            deletedAt: null,
            parentId: null,
          },
          select: { id: true },
        });
        if (!parent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid parent category",
          });
        }
      }

      const nameChanged =
        input.name !== undefined &&
        input.name !== current.name &&
        input.name !== current.nameEn &&
        input.name !== current.nameEs;

      if (input.name !== undefined && nameChanged) {
        const dup = await db.category.findFirst({
          where: {
            organizationId: orgId,
            deletedAt: null,
            id: { not: current.id },
            name: { equals: input.name, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (dup) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A category with that name already exists",
          });
        }
      }

      return db.category.update({
        where: { id: current.id },
        data: {
          ...(input.name !== undefined && nameChanged
            ? {
                name: input.name,
                nameEn: null,
                nameEs: null,
                isSystem: false,
              }
            : {}),
          ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.spendingNature !== undefined
            ? {
                spendingNature:
                  current.type === "EXPENSE" ? input.spendingNature : null,
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          nameEn: true,
          nameEs: true,
          isSystem: true,
          icon: true,
          color: true,
          type: true,
          spendingNature: true,
          parentId: true,
        },
      });
    }),

  /** Soft-deletes a category (and any active subcategories) without altering historical records. */
  delete: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);

      const target = await db.category.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: null },
        select: { id: true },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      const activeChildren = await db.category.findMany({
        where: {
          organizationId: orgId,
          parentId: target.id,
          deletedAt: null,
        },
        select: { id: true },
      });
      const childIds = activeChildren.map((c) => c.id);
      const now = new Date();

      await db.$transaction([
        db.category.update({
          where: { id: target.id },
          data: { deletedAt: now },
        }),
        ...(childIds.length > 0
          ? [
              db.category.updateMany({
                where: { id: { in: childIds }, organizationId: orgId },
                data: { deletedAt: now },
              }),
            ]
          : []),
      ]);

      return { id: target.id, deletedChildIds: childIds };
    }),

  /** Restores a soft-deleted category (and any children soft-deleted alongside it). */
  restore: protectedProcedure
    .use(requirePermission(p.dashboard.basic))
    .input(
      z.object({
        id: z.number().int().positive(),
        childIds: z.array(z.number().int().positive()).max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx.orgId);

      const target = await db.category.findFirst({
        where: { id: input.id, organizationId: orgId, deletedAt: { not: null } },
        select: { id: true, name: true },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      const conflict = await db.category.findFirst({
        where: {
          organizationId: orgId,
          deletedAt: null,
          name: { equals: target.name, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An active category with that name already exists",
        });
      }

      const childIds = input.childIds ?? [];
      await db.$transaction([
        db.category.update({
          where: { id: target.id },
          data: { deletedAt: null },
        }),
        ...(childIds.length > 0
          ? [
              db.category.updateMany({
                where: { id: { in: childIds }, organizationId: orgId },
                data: { deletedAt: null },
              }),
            ]
          : []),
      ]);

      return { id: target.id };
    }),
});

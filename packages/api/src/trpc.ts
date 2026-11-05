import { initTRPC, TRPCError } from "@trpc/server";
import z, { ZodError } from "zod";
import type { PermissionKey } from "./permissions";

export type SessionUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  permissions: string[];
  // The web's `customSession` returns role ids as `number[]`
  // (Prisma's r.id). Typed as `unknown[]` because tRPC only uses
  // `permissions` and `emailVerified`; the contents of `roles` are
  // consumed by each platform with its own shape.
  roles: unknown[];
};

export type ContextSession = {
  user: SessionUser;
  // The rest of the better-auth payload is intentionally not typed here:
  // `@app/api` must not import from `@app/web` (it coupled React Native's
  // typecheck with `next/headers`). The full session object still flows
  // at runtime; only the subset tRPC uses is typed.
  session: Record<string, unknown>;
};

export type Context = {
  orgId: string | null;
  session: ContextSession | null;
};

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? z.treeifyError(error.cause) : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user.emailVerified) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({ ctx });
});

// Server-side helper to validate a permission: .use(requirePermission(p.users.read))
export function requirePermission(permissionKey: PermissionKey) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.session?.user.permissions.includes(permissionKey.key)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `You don't have permission to perform this action: ${permissionKey.key}`,
      });
    }
    return next({ ctx });
  });
}

export const createCallerFactory = t.createCallerFactory;

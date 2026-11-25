import { TRPCError } from "@trpc/server";
import z from "zod";
import { db } from "@app/db";
import {
  buildPushPayloadFromDigest,
  buildUserDigestPreview,
  computeNextRunAt,
  getLocalDateParts,
  getVapidPublicKey,
  isPushConfigured,
  isValidTimeZone,
  sendPushToSubscriptions,
} from "../lib/push-notifications";
import { protectedProcedure, router } from "../trpc";

const DEFAULT_PREFERENCES = {
  enabled: false,
  dailyTime: "08:00",
  timezone: "America/El_Salvador",
  locale: "es",
  advanceDays: 3,
  notifyCardPayments: true,
  notifyCardCutoffs: true,
  notifyRecurrings: true,
  notifyDebts: true,
  notifyInstallments: false,
  quietIfEmpty: true,
};

const updatePreferencesInput = z.object({
  enabled: z.boolean().optional(),
  dailyTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM 24h time")
    .optional(),
  timezone: z
    .string()
    .min(1)
    .max(64)
    .refine(isValidTimeZone, "Invalid IANA timezone")
    .optional(),
  locale: z.enum(["es", "en"]).optional(),
  advanceDays: z.number().int().min(0).max(14).optional(),
  notifyCardPayments: z.boolean().optional(),
  notifyCardCutoffs: z.boolean().optional(),
  notifyRecurrings: z.boolean().optional(),
  notifyDebts: z.boolean().optional(),
  notifyInstallments: z.boolean().optional(),
  quietIfEmpty: z.boolean().optional(),
});

const subscribeInput = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(10).max(512),
    auth: z.string().min(10).max(512),
  }),
  userAgent: z.string().max(512).optional(),
  deviceLabel: z.string().max(120).optional(),
  timezone: z.string().max(64).optional(),
  locale: z.enum(["es", "en"]).optional(),
});

function inferDeviceLabel(userAgent?: string | null): string {
  const ua = userAgent ?? "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh|Mac OS/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Browser";
}

export const notificationsRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user.id;
    const [pref, subs] = await Promise.all([
      db.notificationPreference.findUnique({ where: { userId } }),
      db.pushSubscription.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          endpoint: true,
          deviceLabel: true,
          userAgent: true,
          lastUsedAt: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      configured: isPushConfigured(),
      vapidPublicKey: getVapidPublicKey(),
      preferences: pref
        ? {
            enabled: pref.enabled,
            dailyTime: pref.dailyTime,
            timezone: pref.timezone,
            locale: pref.locale === "en" ? ("en" as const) : ("es" as const),
            advanceDays: pref.advanceDays,
            notifyCardPayments: pref.notifyCardPayments,
            notifyCardCutoffs: pref.notifyCardCutoffs,
            notifyRecurrings: pref.notifyRecurrings,
            notifyDebts: pref.notifyDebts,
            notifyInstallments: pref.notifyInstallments,
            quietIfEmpty: pref.quietIfEmpty,
            nextRunAt: pref.nextRunAt?.toISOString() ?? null,
            lastSentAt: pref.lastSentAt?.toISOString() ?? null,
          }
        : {
            ...DEFAULT_PREFERENCES,
            locale: "es" as const,
            nextRunAt: null,
            lastSentAt: null,
          },
      subscriptions: subs.map((s) => ({
        id: s.id,
        endpoint: s.endpoint,
        deviceLabel: s.deviceLabel ?? inferDeviceLabel(s.userAgent),
        lastUsedAt: s.lastUsedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }),

  preview: protectedProcedure
    .input(
      z
        .object({
          locale: z.enum(["es", "en"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session!.user.id;
      const orgId = ctx.orgId;
      if (!orgId) {
        return { items: [], title: "", body: "", url: "/notifications", tag: "preview" };
      }

      const pref = await db.notificationPreference.findUnique({
        where: { userId },
      });

      return buildUserDigestPreview(orgId, {
        advanceDays: pref?.advanceDays ?? DEFAULT_PREFERENCES.advanceDays,
        notifyCardPayments:
          pref?.notifyCardPayments ?? DEFAULT_PREFERENCES.notifyCardPayments,
        notifyCardCutoffs:
          pref?.notifyCardCutoffs ?? DEFAULT_PREFERENCES.notifyCardCutoffs,
        notifyRecurrings:
          pref?.notifyRecurrings ?? DEFAULT_PREFERENCES.notifyRecurrings,
        notifyDebts: pref?.notifyDebts ?? DEFAULT_PREFERENCES.notifyDebts,
        notifyInstallments:
          pref?.notifyInstallments ?? DEFAULT_PREFERENCES.notifyInstallments,
        locale: input?.locale ?? pref?.locale ?? DEFAULT_PREFERENCES.locale,
      });
    }),

  updatePreferences: protectedProcedure
    .input(updatePreferencesInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user.id;
      const existing = await db.notificationPreference.findUnique({
        where: { userId },
      });

      const merged = {
        enabled: input.enabled ?? existing?.enabled ?? DEFAULT_PREFERENCES.enabled,
        dailyTime:
          input.dailyTime ?? existing?.dailyTime ?? DEFAULT_PREFERENCES.dailyTime,
        timezone:
          input.timezone ?? existing?.timezone ?? DEFAULT_PREFERENCES.timezone,
        locale: input.locale ?? existing?.locale ?? DEFAULT_PREFERENCES.locale,
        advanceDays:
          input.advanceDays ??
          existing?.advanceDays ??
          DEFAULT_PREFERENCES.advanceDays,
        notifyCardPayments:
          input.notifyCardPayments ??
          existing?.notifyCardPayments ??
          DEFAULT_PREFERENCES.notifyCardPayments,
        notifyCardCutoffs:
          input.notifyCardCutoffs ??
          existing?.notifyCardCutoffs ??
          DEFAULT_PREFERENCES.notifyCardCutoffs,
        notifyRecurrings:
          input.notifyRecurrings ??
          existing?.notifyRecurrings ??
          DEFAULT_PREFERENCES.notifyRecurrings,
        notifyDebts:
          input.notifyDebts ??
          existing?.notifyDebts ??
          DEFAULT_PREFERENCES.notifyDebts,
        notifyInstallments:
          input.notifyInstallments ??
          existing?.notifyInstallments ??
          DEFAULT_PREFERENCES.notifyInstallments,
        quietIfEmpty:
          input.quietIfEmpty ??
          existing?.quietIfEmpty ??
          DEFAULT_PREFERENCES.quietIfEmpty,
      };

      const now = new Date();
      const scheduleChanged =
        input.dailyTime !== undefined || input.timezone !== undefined;
      const skipDateKey = scheduleChanged ? null : existing?.lastSentDate ?? null;
      const nextRunAt = merged.enabled
        ? computeNextRunAt(merged.dailyTime, merged.timezone, now, skipDateKey)
        : null;

      const updated = await db.notificationPreference.upsert({
        where: { userId },
        create: {
          userId,
          organizationId: ctx.orgId ?? null,
          ...merged,
          nextRunAt,
        },
        update: {
          ...(ctx.orgId ? { organizationId: ctx.orgId } : {}),
          ...merged,
          nextRunAt,
          // If user changed daily time to a later hour today, allow today's slot to fire
          ...(scheduleChanged &&
          nextRunAt &&
          getLocalDateParts(nextRunAt, merged.timezone).dateKey ===
            getLocalDateParts(now, merged.timezone).dateKey
            ? { lastSentDate: null }
            : {}),
        },
      });

      return {
        enabled: updated.enabled,
        dailyTime: updated.dailyTime,
        timezone: updated.timezone,
        locale: updated.locale,
        advanceDays: updated.advanceDays,
        notifyCardPayments: updated.notifyCardPayments,
        notifyCardCutoffs: updated.notifyCardCutoffs,
        notifyRecurrings: updated.notifyRecurrings,
        notifyDebts: updated.notifyDebts,
        notifyInstallments: updated.notifyInstallments,
        quietIfEmpty: updated.quietIfEmpty,
        nextRunAt: updated.nextRunAt?.toISOString() ?? null,
      };
    }),

  subscribe: protectedProcedure
    .input(subscribeInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user.id;
      const label =
        input.deviceLabel?.trim() || inferDeviceLabel(input.userAgent);

      const sub = await db.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: {
          userId,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent ?? null,
          deviceLabel: label,
        },
        update: {
          userId,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent ?? null,
          deviceLabel: label,
          failureCount: 0,
        },
      });

      // Ensure user has an active preference row enabled on first device subscription
      const existingPref = await db.notificationPreference.findUnique({
        where: { userId },
      });
      if (!existingPref) {
        const tz =
          input.timezone && isValidTimeZone(input.timezone)
            ? input.timezone
            : DEFAULT_PREFERENCES.timezone;
        const locale = input.locale ?? DEFAULT_PREFERENCES.locale;
        await db.notificationPreference.create({
          data: {
            userId,
            organizationId: ctx.orgId ?? null,
            ...DEFAULT_PREFERENCES,
            enabled: true,
            timezone: tz,
            locale,
            nextRunAt: computeNextRunAt(DEFAULT_PREFERENCES.dailyTime, tz),
          },
        });
      } else if (!existingPref.enabled) {
        await db.notificationPreference.update({
          where: { id: existingPref.id },
          data: {
            enabled: true,
            ...(ctx.orgId ? { organizationId: ctx.orgId } : {}),
            nextRunAt: computeNextRunAt(
              existingPref.dailyTime,
              existingPref.timezone,
              new Date(),
              existingPref.lastSentDate,
            ),
          },
        });
      }

      return { id: sub.id, deviceLabel: sub.deviceLabel ?? label };
    }),

  unsubscribe: protectedProcedure
    .input(
      z
        .object({
          id: z.string().optional(),
          endpoint: z.string().optional(),
        })
        .refine((v) => Boolean(v.id || v.endpoint), "Provide id or endpoint"),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user.id;
      const result = await db.pushSubscription.deleteMany({
        where: {
          userId,
          ...(input.id ? { id: input.id } : {}),
          ...(input.endpoint ? { endpoint: input.endpoint } : {}),
        },
      });
      return { deleted: result.count };
    }),

  sendTest: protectedProcedure
    .input(z.object({ locale: z.enum(["es", "en"]).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      if (!isPushConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "VAPID keys are not configured on the server",
        });
      }

      const userId = ctx.session!.user.id;
      const [pref, subs] = await Promise.all([
        db.notificationPreference.findUnique({ where: { userId } }),
        db.pushSubscription.findMany({
          where: { userId },
          select: {
            id: true,
            endpoint: true,
            p256dh: true,
            auth: true,
            failureCount: true,
          },
        }),
      ]);

      if (subs.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No subscribed devices found",
        });
      }

      const locale = input?.locale ?? (pref?.locale === "en" ? "en" : "es");
      const orgId = ctx.orgId ?? pref?.organizationId ?? null;

      let title =
        locale === "en"
          ? "Notifications active"
          : "Notificaciones activas";
      let body =
        locale === "en"
          ? "You'll get your daily pending summary right on time."
          : "Recibirás tu resumen diario de pendientes justo a la hora configurada.";
      let url = `/${locale}/notifications`;

      if (orgId) {
        const digest = await buildUserDigestPreview(orgId, {
          advanceDays: pref?.advanceDays ?? DEFAULT_PREFERENCES.advanceDays,
          notifyCardPayments:
            pref?.notifyCardPayments ?? DEFAULT_PREFERENCES.notifyCardPayments,
          notifyCardCutoffs:
            pref?.notifyCardCutoffs ?? DEFAULT_PREFERENCES.notifyCardCutoffs,
          notifyRecurrings:
            pref?.notifyRecurrings ?? DEFAULT_PREFERENCES.notifyRecurrings,
          notifyDebts: pref?.notifyDebts ?? DEFAULT_PREFERENCES.notifyDebts,
          notifyInstallments:
            pref?.notifyInstallments ?? DEFAULT_PREFERENCES.notifyInstallments,
          locale,
        });
        if (digest.items.length > 0) {
          return sendPushToSubscriptions(
            subs,
            buildPushPayloadFromDigest(digest, locale),
          );
        }
      }

      return sendPushToSubscriptions(subs, {
        title,
        body,
        url,
        tag: "firecent-test-notification",
      });
    }),
});

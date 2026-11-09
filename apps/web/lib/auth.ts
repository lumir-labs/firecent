import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@app/db";
import { nextCookies } from "better-auth/next-js";
import { customSession } from "better-auth/plugins/custom-session";
import { cookies, headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { organization, magicLink, twoFactor } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import { ROLE_USER } from "@app/api/roles";
import { ensureRole } from "./roles";
import { magicLinkBackoff } from "./magic-link-backoff";
import {
  isEmailConfigured,
  logMailToConsole,
  magicLinkHtml,
  sendMail,
} from "@/services/email";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Stackgoat";

/** Minutes the access link stays valid. */
const MAGIC_LINK_EXPIRES_IN_MINUTES = 15;

/**
 * 2FA for the sign-in paths the `twoFactor` plugin does NOT intercept: its
 * hook only matches /sign-in/{email,username,phone-number}. This mini-plugin
 * replicates its recipe (destroy the freshly created session, issue the
 * challenge in the `two_factor` cookie) for every other way a session is born:
 *
 * - `/magic-link/verify`: redirects to the callbackURL with
 *   `?twoFactorRedirect=true`; the login-form shows the TOTP step.
 * - `/callback/:id` (browser OAuth, e.g. Google): the session is created
 *   inside the provider callback, so the flag is appended to the redirect
 *   better-auth already emits. With no session cookie the proxy bounces to
 *   the login form, which shows the step (via the flag, or via the
 *   pending-challenge cookie when the target was `/` and the flag got
 *   dropped).
 * - `/sign-in/social` with an idToken (native Google on mobile): the session
 *   is created inline and answered as JSON, so we mirror the plugin's own
 *   shape (`{ twoFactorRedirect: true, twoFactorMethods }`).
 *
 * `verifyTotp`/`verifyBackupCode` complete the login in every case.
 * v1: no trusted-device (same trade-off the plugin applies only where it
 * covers; trustDevice was never implemented for these paths).
 *
 * Type NOTE: the handler is cast to `never` on purpose — in better-auth
 * 1.7.3, an un-casted `createAuthMiddleware` inside `hooks` breaks the
 * inference of ALL plugins (Session loses customSession and
 * additionalFields). The cast isolates the generic; runtime is identical.
 */

/** The endpoints intercepted here; everything else is the plugin's job. */
const SIGN_IN_TWO_FACTOR_PATHS = [
  "/magic-link/verify",
  "/callback/:id",
  "/sign-in/social",
];

const signInTwoFactorHandler = createAuthMiddleware(async (ctx) => {
  const data = ctx.context.newSession;
  if (!data) return;
  const user = data.user as { id: string; twoFactorEnabled?: boolean };
  if (!user.twoFactorEnabled) return;
  let destination = (ctx.query?.callbackURL as string | undefined) ?? "/";
  if (ctx.path === "/callback/:id") {
    // The callback handler throws its redirect; its Location header is the
    // final callbackURL (or newUserURL) better-auth resolved from the OAuth
    // state, so the flag survives arbitrary deep links.
    const headers = (ctx.context.returned as { headers?: Headers } | undefined)
      ?.headers;
    const location =
      headers instanceof Headers ? headers.get("location") : null;
    if (location) destination = location;
  }
  deleteSessionCookie(ctx, true);
  await ctx.context.internalAdapter.deleteSession(
    (data.session as { token: string }).token,
  );
  ctx.context.setNewSession(null);
  const maxAge = 600;
  // "two_factor": the plugin's TWO_FACTOR_COOKIE_NAME (not exported).
  const twoFactorCookie = ctx.context.createAuthCookie("two_factor", {
    maxAge,
  });
  const identifier = `2fa-${generateRandomString(20)}`;
  const expiresAt = new Date(Date.now() + maxAge * 1000);
  await ctx.context.internalAdapter.createVerificationValue({
    value: user.id,
    identifier,
    expiresAt,
  });
  await ctx.context.internalAdapter.createVerificationValue({
    value: "0",
    identifier: `2fa-attempts-${identifier}`,
    expiresAt,
  });
  await ctx.setSignedCookie(
    twoFactorCookie.name,
    identifier,
    ctx.context.secret,
    twoFactorCookie.attributes,
  );
  // Native idToken sign-in expects JSON (there is no redirect to hijack):
  // mirror the plugin's response so `twoFactorClient` and the mobile step
  // pick it up.
  if (ctx.path === "/sign-in/social") {
    const userTotpSecret = (await ctx.context.adapter.findOne({
      model: "twoFactor",
      where: [{ field: "userId", value: user.id }],
    })) as { verified?: boolean } | null;
    const twoFactorMethods: string[] = [];
    if (userTotpSecret && userTotpSecret.verified !== false) {
      twoFactorMethods.push("totp");
    }
    return ctx.json({ twoFactorRedirect: true, twoFactorMethods });
  }
  const url = new URL(destination, ctx.context.baseURL);
  url.searchParams.set("twoFactorRedirect", "true");
  return ctx.redirect(url.toString());
});

const signInTwoFactorHook: import("better-auth").BetterAuthPlugin = {
  id: "sign-in-2fa",
  hooks: {
    after: [
      {
        matcher(context) {
          return SIGN_IN_TWO_FACTOR_PATHS.includes(context.path ?? "");
        },
        handler: signInTwoFactorHandler as never,
      },
    ],
  },
};

export const auth = betterAuth({
  // Real rate limiting (single-instance, in-memory storage): global 100/min +
  // magic-link 5/min against email enumeration and SMTP email-bombing.
  // Multi-instance → `storage: "secondary-storage"` + a secondary adapter.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "memory",
    customRules: {
      "/sign-in/magic-link": { window: 60, max: 5 },
    },
  },
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  trustedOrigins: [
    "stackgoat://",
    // Development: the Expo client (exp://) and the backend's LAN IP.
    ...(process.env.NODE_ENV === "development"
      ? [
          "exp://",
          "exp://**",
          "exp://192.168.*.*:*/**",
          "http://localhost:3000",
          "http://192.168.*.*:3000",
        ]
      : []),
  ],
  session: {
    cookieCache: {
      enabled: false,
    },
    additionalFields: {
      // Written by the `organization` plugin: the session's active organization.
      activeOrganizationId: {
        type: "string",
        required: false,
      },
    },
  },
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      mapProfileToUser: (profile) => ({
        name: profile.name,
        firstName: profile.given_name?.split(" ")?.[0] ?? null,
        middleName: profile.given_name?.split(" ")?.[1] ?? null,
        lastName: profile.family_name,
        lastName2: profile.family_name?.split(" ")?.[1] ?? null,
        email: profile.email,
        image: profile.picture,
      }),
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Every new user starts with the `user` role (least access).
        // Each role's permissions are declared in @app/api/roles (ROLE_DEFINITIONS).
        // The `root` role is NOT assigned automatically: it is granted via the seed
        // (`bun run db:seed -- --email=...`) or from the admin panel.
        //
        // NOTE: attach AFTER creation with our own client — NOT via nested
        // `roles.connect` in a `before` hook. better-auth's adapter silently
        // drops unknown nested writes, so signups were created with ZERO roles
        // (invisible org menu/pages, no errors anywhere).
        after: async (user) => {
          const defaultRole = await ensureRole(ROLE_USER);
          const existing = await db.user.findUnique({
            where: { id: user.id },
            select: { roles: { select: { id: true } } },
          });
          if (!existing?.roles.some((r) => r.id === defaultRole.id)) {
            await db.user.update({
              where: { id: user.id },
              data: { roles: { connect: { id: defaultRole.id } } },
            });
          }
        },
      },
    },
  },
  plugins: [
    expo(),
    organization({
      // Email invitations (item 2): the plugin creates the Invitation and
      // calls this hook to send the link. Without SMTP it only works locally
      // (logMailToConsole); in production without SMTP an error is thrown,
      // same as the magic-link. The accept URL lives at `/(locale)/invitations/accept`.
      invitationExpiresIn: 48 * 3600,
      cancelPendingInvitationsOnReInvite: true,
      async sendInvitationEmail(data) {
        const base =
          process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
        const url = `${base}/invitations/accept?id=${data.id}`;
        const subject = `You've been invited to ${data.organization.name} on ${APP_NAME}`;
        const text = [
          `Hi,`,
          ``,
          `${data.inviter.user.name ?? data.inviter.user.email} invited you to join ${data.organization.name} as ${data.role}.`,
          ``,
          `Accept here (expires in 48 hours):`,
          ``,
          url,
          ``,
          `If you weren't expecting this invitation, ignore this message.`,
        ].join("\n");
        if (!isEmailConfigured()) {
          if (process.env.NODE_ENV === "production") {
            throw new Error(
              "SMTP not configured: set SMTP_HOST and EMAIL_FROM",
            );
          }
          logMailToConsole({ to: data.email, subject, text });
          return;
        }
        await sendMail({ to: data.email, subject, text });
      },
    }),
    /**
     * Passwordless login: email + one-time link.
     * - `disableSignUp` stays false: the link also signs the new user up
     *   (better-auth creates them with `emailVerified: true`), and that user
     *   gets the `user` role via the hook below.
     * - `storeToken: "hashed"`: the token in the `Verification` table is hashed
     *   (nothing reusable is stored in plain text).
     */
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRES_IN_MINUTES * 60,
      storeToken: "hashed",
      sendMagicLink: async ({ email, url }) => {
        const subject = `Your access link to ${APP_NAME}`;
        const text = [
          `Hi,`,
          ``,
          `Click this link to sign in to ${APP_NAME} (expires in ${MAGIC_LINK_EXPIRES_IN_MINUTES} minutes):`,
          ``,
          url,
          ``,
          `If you didn't request this access, ignore this message.`,
        ].join("\n");

        // Without SMTP configured we can still test locally: the link is
        // printed to the Next server console (non-production only; in
        // production logMailToConsole is a no-op and an error is thrown).
        if (!isEmailConfigured()) {
          if (process.env.NODE_ENV === "production") {
            throw new Error(
              "SMTP not configured: set SMTP_HOST and EMAIL_FROM",
            );
          }
          logMailToConsole({ to: email, subject, text });
          return;
        }

        await sendMail({
          to: email,
          subject,
          text,
          html: magicLinkHtml({
            appName: APP_NAME,
            url,
            minutes: MAGIC_LINK_EXPIRES_IN_MINUTES,
          }),
        });
      },
    }),
    /**
     * 2FA TOTP with backup codes (item 6). Passwordless-friendly:
     * `allowPasswordless: true` lets users manage 2FA without a password when
     * they don't have a credential account (ours is magic-link/Google —
     * if a credential account ever exists, better-auth requires a password
     * again). The plugin's own hook ONLY intercepts /sign-in/{email,username,
     * phone-number}: `signInTwoFactorHook` below covers the remaining
     * session-creating paths (magic-link, the Google OAuth callback on web,
     * and native idToken sign-in on mobile) with the same recipe. No session
     * survives; the TOTP step is completed with
     * `authClient.twoFactor.verifyTotp`/`verifyBackupCode` in the login-form
     * (web) and `apps/mobile/src/app/sign-in.tsx` (mobile).
     */
    twoFactor({ allowPasswordless: true }),
    // Before signInTwoFactorHook: it needs `newSession` to reset the streak.
    magicLinkBackoff,
    signInTwoFactorHook,
    customSession(async ({ user, session }) => {
      if (!user) {
        return { user, session };
      }

      const userWithPermissions = await db.user.findUnique({
        where: { id: user.id },
        select: {
          isOnboarded: true,
          twoFactorEnabled: true,
          // DSR guard: anonymized users (deleteMyAccount) don't get a
          // session — `getServerSession` treats them as logged out.
          deletedAt: true,
          roles: {
            select: {
              id: true,
              name: true,
              permissions: true,
            },
          },
        },
      });

      // Self-heal: users created through any path that skipped the create
      // hook (e.g. the old `before` hook whose nested `roles.connect` the
      // adapter dropped) have ZERO roles — no menu, no org pages, no errors.
      // Grant the default role once instead of leaving them stranded.
      // Deliberate trade-off: an admin stripping ALL roles re-grants `user`
      // on the next session read; delete the user to fully revoke.
      let roles = userWithPermissions?.roles ?? [];
      if (
        roles.length === 0 &&
        userWithPermissions &&
        !userWithPermissions.deletedAt
      ) {
        const defaultRole = await ensureRole(ROLE_USER);
        await db.user
          .update({
            where: { id: user.id },
            data: { roles: { connect: { id: defaultRole.id } } },
          })
          .catch(() => {});
        const refreshed = await db.user.findUnique({
          where: { id: user.id },
          select: {
            roles: { select: { id: true, name: true, permissions: true } },
          },
        });
        roles = refreshed?.roles ?? roles;
      }

      const permissions =
        roles.flatMap((role) =>
          role.permissions.map((perm) => perm.name),
        ) ?? [];

      const uniquePermissions = [...new Set(permissions)];

      return {
        user: {
          ...user,
          isOnboarded: userWithPermissions?.isOnboarded,
          twoFactorEnabled: userWithPermissions?.twoFactorEnabled ?? false,
          deletedAt: userWithPermissions?.deletedAt ?? null,
          permissions: uniquePermissions,
          roles: roles.map((r) => r.id) ?? [],
        },
        session,
      };
    }),
    nextCookies(),
  ],
  // No passwords: access is via Magic Link (email) or Google OAuth.
  // `emailAndPassword` stays explicitly disabled so that
  // better-auth doesn't expose `/sign-up/email` or `/sign-in/email`.
  emailAndPassword: {
    enabled: false,
  },
  user: {
    additionalFields: {
      // Optional on purpose: Magic Link sign-up only brings `email`
      // (+ `name` if the user types it); requiring them would break sign-up
      // via link. They are completed during onboarding.
      firstName: {
        type: "string",
        required: false,
      },
      lastName: {
        type: "string",
        required: false,
      },
      middleName: {
        type: "string",
        required: false,
      },
      lastName2: {
        type: "string",
        required: false,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;

export async function getServerSession() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    // DSR guard: anonymized/deleted account = no session. We clear cookies
    // so no orphaned token remains reusable. NOTE: in production over
    // https better-auth prefixes cookies with `__Secure-` — this delete by
    // exact name is a no-op there; harmless because the sessions were
    // already deleted from the DB by the cascade (account-core.ts step 1).
    if (session?.user && (session.user as { deletedAt?: Date | null }).deletedAt) {
      const cookieStore = await cookies();
      cookieStore.delete("better-auth-session_token");
      cookieStore.delete("better-auth.session_data");
      cookieStore.delete("better-auth.account_data");
      return null;
    }
    return session;
  } catch (error) {
    // Deja pasar las señales internas de Next (rutas dinámicas, redirect,
    // notFound): si se atrapan aquí, Next no puede marcar la ruta como dinámica.
    unstable_rethrow(error);
    console.error(error);
    const cookieStore = await cookies();
    cookieStore.delete("better-auth-session_token");
    cookieStore.delete("better-auth.session_data");
    cookieStore.delete("better-auth.account_data");
    return null;
  }
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Defense in depth: if a refactor stops calling the guard, this fails.
// Doesn't replace behavior tests; it pins the wiring.
const root = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);
const read = (p) => readFileSync(join(root, p), "utf8");

test("updateUser calls the whitelist guard", () => {
  const src = read("apps/web/lib/actions/users.ts");
  assert.ok(src.includes("isUserUpdateAllowed"));
});

test("getUser requires p.users.read", () => {
  const src = read("apps/web/lib/actions/users.ts");
  const body = src.slice(src.indexOf("export async function getUser"));
  assert.ok(body.includes("p.users.read"));
});

test("createOrganizationOnboarding sets the active org", () => {
  const src = read("apps/web/lib/actions/organization.ts");
  assert.ok(src.includes("setActiveOrganization"));
});

test("hasApiKeyScope is deny-by-default", () => {
  const src = read("packages/api/src/api-keys/service.ts");
  assert.ok(src.includes("if (context.scopes.length === 0) return false"));
});

test("logMailToConsole is a no-op in production", () => {
  const src = read("apps/web/services/email.ts");
  assert.ok(src.includes('process.env.NODE_ENV === "production"'));
});

test("rateLimit with customRules for magic-link", () => {
  const src = read("apps/web/lib/auth.ts");
  assert.ok(src.includes("/sign-in/magic-link"));
});

test("org-switcher exists and uses setActive", () => {
  const src = read("apps/web/components/common/org-switcher.tsx");
  assert.ok(src.includes("authClient.organization.setActive"));
  assert.ok(src.includes("router.refresh"));
});

test("both headers render OrgSwitcher", () => {
  const home = read(
    "apps/web/app/[locale]/(protected)/(home)/_components/header.tsx",
  );
  const admin = read(
    "apps/web/app/[locale]/(protected)/admin/_components/header.tsx",
  );
  assert.ok(home.includes("OrgSwitcher"));
  assert.ok(admin.includes("OrgSwitcher"));
});

test("onboarding gates by isOnboarded (consistent with protected layout)", () => {
  const src = read("apps/web/app/[locale]/(auth)/onboarding/page.tsx");
  assert.ok(src.includes("isOnboarded"));
  assert.ok(!src.includes("getSessionOrganization"));
});

test("getServerSession treats deletedAt as logged out", () => {
  const src = read("apps/web/lib/auth.ts");
  assert.ok(src.includes("deletedAt"));
  assert.ok(/deletedAt.*return null|if.*deletedAt[\s\S]*?return null/s.test(src));
});

test("deleteUser admin revokes sessions before the soft-delete", () => {
  const src = read("apps/web/lib/actions/users.ts");
  const body = src.slice(src.indexOf("export async function deleteUser"));
  assert.ok(body.includes("session.deleteMany"));
});

test("deleteMyAccount real + purge script exist", () => {
  const acc = read("apps/web/lib/actions/account.ts");
  assert.ok(acc.includes("anonymizeAndDeleteUser"));
  assert.ok(!acc.includes("requestDeleteMyAccount"));
  assert.ok(
    existsSyncSync("scripts/purge-expired.mjs"),
    "missing scripts/purge-expired.mjs",
  );
});

test("2FA: plugin server+client, login step, card, schema, magic-link hook", () => {  const auth = read("apps/web/lib/auth.ts");
  assert.ok(auth.includes("twoFactor({ allowPasswordless: true })"));
  // Custom hook: magic-link with 2FA doesn't create a session (the plugin's recipe).
  assert.ok(auth.includes('"/magic-link/verify"'));
  assert.ok(auth.includes('"two_factor"'));
  const client = read("apps/web/lib/auth-client.ts");
  assert.ok(client.includes("twoFactorClient()"));
  const login = read(
    "apps/web/app/[locale]/(auth)/auth/login/_components/login-form.tsx",
  );
  assert.ok(login.includes("twoFactorRedirect"));
  assert.ok(login.includes("verifyTotp"));
  assert.ok(
    existsSyncSync(
      "apps/web/app/[locale]/(protected)/(home)/profile/_components/two-factor-card.tsx",
    ),
    "missing two-factor-card",
  );
  const schema = read("packages/db/prisma/schema.prisma");
  assert.ok(schema.includes("model TwoFactor"));
  assert.ok(schema.includes("twoFactorEnabled"));
});

test("2FA: Google sign-in challenges TOTP too (web + mobile)", () => {
  const auth = read("apps/web/lib/auth.ts");
  // The plugin's own hook only matches /sign-in/{email,username,phone-number}:
  // the OAuth callback (browser) and the native idToken sign-in must be
  // intercepted as well, or Google logins bypass 2FA silently.
  assert.ok(
    auth.includes('"/callback/:id"'),
    "auth.ts must intercept the OAuth callback (browser Google sign-in)",
  );
  assert.ok(
    auth.includes('"/sign-in/social"'),
    "auth.ts must intercept native (idToken) social sign-in",
  );
  assert.ok(
    auth.includes("twoFactorMethods"),
    "native flow must mirror the plugin's JSON shape",
  );
  const page = read("apps/web/app/[locale]/(auth)/auth/login/page.tsx");
  // The hook destroys the session; when the redirect lands on "/" the proxy
  // drops `?twoFactorRedirect=true`. The page must fall back to the pending
  // challenge cookie or the user never sees the TOTP step.
  assert.ok(
    page.includes("pendingTwoFactor"),
    "login page must detect the pending two_factor cookie",
  );
  const mobile = read("apps/mobile/src/app/sign-in.tsx");
  // Native flow answers JSON: the app routes on `twoFactorRedirect` instead of
  // guessing from error message contents (the old fragile check).
  assert.ok(
    mobile.includes("twoFactorRedirect"),
    "mobile must route on the twoFactorRedirect response field",
  );
  assert.ok(
    !mobile.includes('msg.includes("two factor")'),
    "mobile must not guess the 2FA challenge from error message text",
  );
  // Returning from the authenticator fires a foreground session refetch;
  // the root layout must not unmount the Stack and the sign-in screen must
  // restore the TOTP step from the persisted challenge cookie, or the user
  // silently lands back on the email form mid-login.
  const layout = read("apps/mobile/src/app/_layout.tsx");
  assert.ok(
    layout.includes("sessionBooted"),
    "root layout must keep the Stack mounted during foreground refetches",
  );
  assert.ok(
    mobile.includes("hasPendingTwoFactorChallenge"),
    "mobile sign-in must restore the TOTP step from the challenge cookie",
  );
});

test("2FA disable requires TOTP re-auth (no one-click disable)", () => {
  const src = read(
    "apps/web/app/[locale]/(protected)/(home)/profile/_components/two-factor-card.tsx",
  );
  // Re-auth gate: disabling must ask for a fresh code first.
  assert.ok(
    src.includes("confirmingDisable"),
    "disable must ask for a confirmation code",
  );
  const disableFn = src.slice(src.indexOf("async function handleConfirmDisable"));
  assert.ok(
    disableFn.includes("verifyTotp"),
    "handleConfirmDisable must verify TOTP before disabling",
  );
  assert.ok(
    disableFn.includes("twoFactor.disable"),
    "handleConfirmDisable must call disable after verifying",
  );
});

function existsSyncSync(p) {
  try {
    readFileSync(join(root, p), "utf8");
    return true;
  } catch {
    return false;
  }
}

test("web auth-client includes organizationClient", () => {
  const src = read("apps/web/lib/auth-client.ts");
  assert.ok(src.includes("organizationClient"));
});

test("magic-link 2FA hook uses the installed plugin cookie name", async () => {  // The "two_factor" cookie name is an INTERNAL plugin constant with no
  // public export. If a better-auth upgrade renames it, magic-link 2FA login
  // breaks silently (challenge cookie unreadable). This test fails first.
  const { TWO_FACTOR_COOKIE_NAME } = await import(
    "../../node_modules/better-auth/dist/plugins/two-factor/constant.mjs"
  );
  const src = read("apps/web/lib/auth.ts");
  assert.ok(
    src.includes(`"${TWO_FACTOR_COOKIE_NAME}"`),
    "auth.ts must use the installed plugin cookie literal",
  );
});

test("default role attached AFTER creation (adapter drops nested writes)", () => {
  const src = read("apps/web/lib/auth.ts");
  assert.ok(src.includes("after: async (user)"));
  assert.ok(src.includes("Self-heal"));
  assert.ok(!src.includes("roles: {\n                connect:"));
});

test("user sidebar uses prefix-safe highlight", () => {
  const src = read(
    "apps/web/app/[locale]/(protected)/(home)/_components/user-sidebar.tsx",
  );
  assert.ok(src.includes("isMenuActive"));
  assert.ok(!src.includes("pathName.startsWith(subItem)"));
});

test("mobile tabs expose the tab-bar variant flag", () => {
  const src = read("apps/mobile/src/app/(tabs)/_layout.tsx");
  assert.ok(src.includes("USE_FLOATING_TAB_BAR"));
  assert.ok(src.includes("FloatingTabBar"));
  assert.ok(src.includes("tabBarActiveTintColor"));
});

test("mobile home renders account + chart, no debug widgets", () => {
  const src = read("apps/mobile/src/app/(tabs)/index.tsx");
  assert.ok(src.includes("WeeklyChart"));
  assert.ok(src.includes("users.getOwn"));
  assert.ok(!src.includes("Stackgoat 🚀"));
  assert.ok(!src.includes("trpc.health.check"));
});

/**
 * Auth guard decision for the RootLayout (`Stack.Protected`, mirror of the
 * web `proxy.ts`). Extracted as pure so it can be tested with `bun test`
 * (gap G6): there is a valid session only if `useSession()` resolved a
 * `user` without error.
 */
type SessionData = { user?: unknown } | null | undefined;

export function isAuthenticatedSession(
  session: SessionData,
  error: unknown,
): boolean {
  return !error && !!session?.user;
}

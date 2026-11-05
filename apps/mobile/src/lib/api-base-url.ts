/**
 * Base URL of the backend (Better Auth + tRPC) for the mobile client.
 *
 * Single source for `auth-client` and `trpc`: both must point to the same
 * backend. Without `EXPO_PUBLIC_API_URL`, `localhost` is used with a visible
 * warning instead of a hardcoded LAN IP (gap G4 §4.1: the dev machine's
 * IP does not belong in the code).
 */
const LOCAL_FALLBACK = "http://localhost:3000";

export function resolveApiBaseUrl(envValue: string | undefined): string {
  const trimmed = envValue?.trim();
  if (trimmed) return trimmed;
  console.warn(
    "[stackgoat] EXPO_PUBLIC_API_URL not defined: falling back to " +
      `${LOCAL_FALLBACK}. On a physical device, set the backend LAN IP ` +
      `in .env (see apps/mobile/.env.example).`,
  );
  return LOCAL_FALLBACK;
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
}

import { useCallback, useEffect, useState } from "react";

const normalize = (email: string) => email.trim().toLowerCase();

/**
 * Client side of the magic-link backoff (server:
 * apps/web/lib/magic-link-backoff.ts): a countdown per email. In-memory
 * only; the server enforces the backoff regardless.
 */
export function useMagicLinkCooldown() {
  const [saved, setSaved] = useState<{ email: string; until: number } | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!saved) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [saved]);

  const start = useCallback((email: string, seconds: number) => {
    setSaved({ email, until: Date.now() + seconds * 1000 });
    setNow(Date.now());
  }, []);

  /** Seconds left for `email` (0 = may request now). */
  const secondsFor = (email: string) =>
    saved && normalize(saved.email) === normalize(email)
      ? Math.max(0, Math.ceil((saved.until - now) / 1000))
      : 0;

  return { start, secondsFor };
}

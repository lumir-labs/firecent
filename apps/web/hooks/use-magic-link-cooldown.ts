"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "magic-link-cooldown";

type Saved = {
  email: string;
  /** Epoch ms when a new link may be requested. */
  until: number;
  /** The last request succeeded (restore the "check your inbox" screen). */
  sent: boolean;
};

const normalize = (email: string) => email.trim().toLowerCase();

function read(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    if (typeof saved.until !== "number" || saved.until <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

function write(saved: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Private mode / blocked storage: the countdown still works in memory,
    // and the server enforces the backoff anyway.
  }
}

/**
 * Client side of the magic-link backoff (server: lib/magic-link-backoff.ts).
 * Keeps the countdown per email and persists it in localStorage so a page
 * refresh doesn't show an enabled button the server would reject.
 * Shared by the login and reset forms (same storage key).
 *
 * `onRestore` fires once on mount when a cooldown is still running, so the
 * form can bring back the email (and the "sent" screen).
 */
export function useMagicLinkCooldown(
  onRestore?: (saved: { email: string; sent: boolean }) => void,
) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // localStorage doesn't exist during SSR, so restore after hydration,
    // on the next frame (keeps the first client render equal to the server's).
    const id = requestAnimationFrame(() => {
      const restored = read();
      if (!restored) return;
      setSaved(restored);
      setNow(Date.now());
      onRestore?.({ email: restored.email, sent: restored.sent });
    });
    return () => cancelAnimationFrame(id);
    // Mount only: restoring twice would override what the user typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!saved) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [saved]);

  const start = useCallback(
    (email: string, seconds: number, sent: boolean) => {
      const next = { email, until: Date.now() + seconds * 1000, sent };
      setSaved(next);
      setNow(Date.now());
      write(next);
    },
    [],
  );

  /** Seconds left for `email` (0 = may request now). */
  const secondsFor = (email: string) =>
    saved && normalize(saved.email) === normalize(email)
      ? Math.max(0, Math.ceil((saved.until - now) / 1000))
      : 0;

  return { start, secondsFor };
}

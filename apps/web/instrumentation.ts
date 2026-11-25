/**
 * Next.js server startup hook.
 *
 * Runs a lightweight in-process scheduler for daily PWA Web Push notifications
 * (compatible with single-container Dokploy deployments with zero external cron).
 * Each tick performs a single indexed query (`enabled = true AND nextRunAt <= NOW()`)
 * and exits in <1ms when no users are due.
 *
 * Set `DISABLE_INTERNAL_CRON=true` if you prefer triggering
 * `POST /api/cron/notifications` via Dokploy Schedules or an external cron.
 */

const TICK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const INITIAL_DELAY_MS = 30 * 1000; // wait 30s after cold start

declare global {
  var __firecentNotificationCronStarted: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_INTERNAL_CRON === "true") return;
  if (process.env.NODE_ENV === "test") return;
  if (globalThis.__firecentNotificationCronStarted) return;

  globalThis.__firecentNotificationCronStarted = true;

  const { dispatchDueDailyNotifications, isPushConfigured } = await import(
    "@app/api/push-notifications"
  );

  if (!isPushConfigured()) {
    return;
  }

  const runTick = async () => {
    try {
      const res = await dispatchDueDailyNotifications();
      if (res.usersNotified > 0 || res.pushesFailed > 0) {
        console.info(
          `[push-cron] checked=${res.usersChecked} notified=${res.usersNotified} sent=${res.pushesSent} failed=${res.pushesFailed} pruned=${res.subscriptionsPruned} (${res.durationMs}ms)`,
        );
      }
    } catch (err) {
      console.error("[push-cron] tick failed:", err);
    }
  };

  const initialTimer = setTimeout(() => {
    void runTick();
    const interval = setInterval(() => {
      void runTick();
    }, TICK_INTERVAL_MS);
    interval.unref?.();
  }, INITIAL_DELAY_MS);
  initialTimer.unref?.();
}

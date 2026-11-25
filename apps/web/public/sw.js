/* Firecent PWA Service Worker — Web Push notifications */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {
    title: "Firecent",
    body: "",
    url: "/",
    tag: "firecent-notification",
    badge: "/splash/app-icons/notification-badge-96.png?v=3",
  };

  try {
    const parsed = event.data.json();
    payload = { ...payload, ...parsed };
  } catch {
    payload.body = event.data.text();
  }

  // Android Chrome draws a gray fallback monogram ("F") on the right when `icon`
  // is omitted. Passing a 1x1 transparent PNG on Android keeps the notification
  // clean (badge-only like native apps), while desktop keeps the full app icon.
  const isAndroid =
    typeof self.navigator !== "undefined" &&
    /Android/i.test(self.navigator.userAgent || "");
  const icon =
    payload.icon ||
    (isAndroid
      ? "/splash/app-icons/notification-transparent.png"
      : "/splash/app-icons/app_dark_180.png");

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon,
      badge: payload.badge,
      tag: payload.tag,
      renotify: true,
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            const url = new URL(targetUrl, self.location.origin).href;
            if ("navigate" in client) {
              client.navigate(url).catch(() => {});
            }
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});

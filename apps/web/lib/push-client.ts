"use client";

export type PushSupportState =
  | "supported"
  | "ios_needs_install"
  | "unsupported"
  | "insecure_context";

export function detectPushSupport(): PushSupportState {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext && window.location.hostname !== "localhost") {
    return "insecure_context";
  }

  const ua = navigator.userAgent || "";
  const isIos =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  if (isIos && !isStandalone && !("PushManager" in window)) {
    return "ios_needs_install";
  }

  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return isIos && !isStandalone ? "ios_needs_install" : "unsupported";
  }

  return "supported";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    return reg;
  } catch {
    return null;
  }
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (detectPushSupport() !== "supported") return null;
  const reg =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await registerServiceWorker());
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export type SerializedPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function subscribeDeviceToPush(
  vapidPublicKey: string,
): Promise<SerializedPushSubscription> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(permission === "denied" ? "PERMISSION_DENIED" : "PERMISSION_DISMISSED");
  }

  const reg =
    (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  if (!reg) {
    throw new Error("SW_UNAVAILABLE");
  }

  // Wait until service worker is active before subscribing
  await navigator.serviceWorker.ready;

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("INVALID_SUBSCRIPTION");
  }

  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}

export async function unsubscribeDeviceFromPush(): Promise<string | null> {
  const sub = await getCurrentPushSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}

export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/El_Salvador";
  } catch {
    return "America/El_Salvador";
  }
}

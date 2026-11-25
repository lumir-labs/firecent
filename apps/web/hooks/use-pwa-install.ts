"use client";

import { useCallback, useSyncExternalStore } from "react";
import { registerServiceWorker } from "@/lib/push-client";

export type PwaInstallMode = "prompt" | "ios" | "installed" | "unavailable";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type PwaSnapshot = {
  mode: PwaInstallMode;
  installing: boolean;
};

const SERVER_SNAPSHOT: PwaSnapshot = {
  mode: "unavailable",
  installing: false,
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
let snapshot: PwaSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(next: PwaSnapshot) {
  if (
    snapshot.mode === next.mode &&
    snapshot.installing === next.installing
  ) {
    return;
  }
  snapshot = next;
  emit();
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function computeMode(): PwaInstallMode {
  if (typeof window === "undefined") return "unavailable";
  if (isStandaloneMode()) return "installed";
  if (isIosDevice()) return "ios";
  if (deferredPrompt) return "prompt";
  return "unavailable";
}

export function initPwaInstallListeners(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  // Register SW early so Chromium browsers can fire `beforeinstallprompt` during onboarding too
  void registerServiceWorker();

  setSnapshot({ mode: computeMode(), installing: false });

  window.addEventListener("beforeinstallprompt", (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    setSnapshot({ mode: computeMode(), installing: false });
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    setSnapshot({ mode: "installed", installing: false });
  });

  const media = window.matchMedia?.("(display-mode: standalone)");
  if (media?.addEventListener) {
    media.addEventListener("change", () => {
      if (isStandaloneMode()) {
        deferredPrompt = null;
      }
      setSnapshot({ mode: computeMode(), installing: false });
    });
  }
}

function subscribe(callback: () => void): () => void {
  if (typeof window !== "undefined") {
    initPwaInstallListeners();
  }
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getClientSnapshot(): PwaSnapshot {
  if (typeof window !== "undefined" && !initialized) {
    initPwaInstallListeners();
  }
  return snapshot;
}

function getServerSnapshot(): PwaSnapshot {
  return SERVER_SNAPSHOT;
}

export function usePwaInstall() {
  const state = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const install = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) return "unavailable";
    const promptEvent = deferredPrompt;
    setSnapshot({ mode: state.mode, installing: true });

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      deferredPrompt = null;
      setSnapshot({
        mode: outcome === "accepted" ? "installed" : computeMode(),
        installing: false,
      });
      return outcome;
    } catch {
      deferredPrompt = null;
      setSnapshot({ mode: computeMode(), installing: false });
      return "dismissed";
    }
  }, [state.mode]);

  return {
    mode: state.mode,
    installing: state.installing,
    canInstallPrompt: state.mode === "prompt",
    isIosInstallable: state.mode === "ios",
    isInstalled: state.mode === "installed",
    install,
  };
}

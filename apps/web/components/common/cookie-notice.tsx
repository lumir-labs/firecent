"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Cookie, ShieldCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_OPEN_EVENT,
  openCookiePreferences,
  parseCookieConsent,
  readCookieConsentRaw,
  saveCookieConsent,
} from "@/lib/cookie-consent";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type CookieNoticeProps = {
  readonly umamiScriptSrc?: string;
  readonly umamiRecorderSrc?: string;
  readonly umamiWebsiteId?: string;
};

const SSR_SENTINEL = "__ssr__";
const UMAMI_SCRIPT_ATTR = "data-fc-umami-script";

function subscribeConsent(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, handler);
  };
}

function getClientSnapshot(): string | null {
  return readCookieConsentRaw();
}

function getServerSnapshot(): string {
  return SSR_SENTINEL;
}

export function CookieNotice({
  umamiScriptSrc,
  umamiRecorderSrc,
  umamiWebsiteId,
}: CookieNoticeProps) {
  const t = useTranslations("Legal.cookieBanner");
  const rawConsent = useSyncExternalStore(
    subscribeConsent,
    getClientSnapshot,
    getServerSnapshot,
  );

  const isHydrated = rawConsent !== SSR_SENTINEL;
  const consent = isHydrated ? parseCookieConsent(rawConsent) : null;
  const analyticsAllowed = consent?.analytics === true;

  const [prefsOpen, setPrefsOpen] = useState(false);
  const [analyticsDraft, setAnalyticsDraft] = useState(false);

  // Allow any footer/settings "Cookie preferences" button to re-open the preferences panel
  useEffect(() => {
    const handleOpen = () => {
      const latest = parseCookieConsent(readCookieConsentRaw());
      setAnalyticsDraft(latest?.analytics ?? false);
      setPrefsOpen(true);
    };
    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, handleOpen);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, handleOpen);
    };
  }, []);

  // Dynamically load or remove Umami analytics + recorder strictly based on user consent
  useEffect(() => {
    if (!umamiWebsiteId) return;

    const scripts = [
      { key: "tracker", src: umamiScriptSrc },
      { key: "recorder", src: umamiRecorderSrc },
    ] as const;

    for (const { key, src } of scripts) {
      if (!src) continue;
      const existing = document.querySelector<HTMLScriptElement>(
        `script[${UMAMI_SCRIPT_ATTR}="${key}"]`,
      );

      if (analyticsAllowed) {
        if (existing) continue;
        const script = document.createElement("script");
        script.src = src;
        script.defer = true;
        script.setAttribute("data-website-id", umamiWebsiteId);
        script.setAttribute(UMAMI_SCRIPT_ATTR, key);
        document.head.appendChild(script);
      } else if (existing) {
        existing.remove();
      }
    }
  }, [analyticsAllowed, umamiScriptSrc, umamiRecorderSrc, umamiWebsiteId]);

  if (!isHydrated) return null;

  const shouldShowBanner = consent === null && !prefsOpen;
  if (!shouldShowBanner && !prefsOpen) return null;

  const handleAcceptAnalytics = () => {
    saveCookieConsent(true);
    setPrefsOpen(false);
  };

  const handleEssentialOnly = () => {
    saveCookieConsent(false);
    setPrefsOpen(false);
  };

  const handleOpenPreferences = () => {
    setAnalyticsDraft(consent?.analytics ?? false);
    setPrefsOpen(true);
  };

  const handleSavePreferences = () => {
    saveCookieConsent(analyticsDraft);
    setPrefsOpen(false);
  };

  return (
    <aside
      role="region"
      aria-label={t("ariaLabel")}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md"
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/95 p-4 text-card-foreground shadow-lg backdrop-blur-md">
        {prefsOpen ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
                  <ShieldCheck className="size-4" aria-hidden />
                </span>
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {t("prefsTitle")}
                </p>
              </div>
              {consent !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setPrefsOpen(false)}
                  aria-label={t("close")}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Essential (always on) */}
              <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/40 p-3">
                <Checkbox checked disabled className="mt-0.5" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {t("essentialTitle")}
                    </span>
                    <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {t("alwaysOn")}
                    </span>
                  </div>
                  <p className="text-xs leading-snug text-muted-foreground">
                    {t("essentialDesc")}
                  </p>
                </div>
              </div>

              {/* Analytics (opt-in Umami) */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/30">
                <Checkbox
                  checked={analyticsDraft}
                  onCheckedChange={(checked) => setAnalyticsDraft(checked)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <span className="block text-xs font-semibold text-foreground">
                    {t("analyticsTitle")}
                  </span>
                  <p className="text-xs leading-snug text-muted-foreground">
                    {t("analyticsDesc")}
                  </p>
                </div>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <Link
                href="/privacy"
                onClick={() => setPrefsOpen(false)}
                className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {t("learnMore")}
              </Link>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEssentialOnly}
                  className="text-xs"
                >
                  {t("reject")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSavePreferences}
                  className="text-xs"
                >
                  {t("savePrefs")}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
                <Cookie className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {t("title")}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("body")}{" "}
                  <Link
                    href="/privacy"
                    className="font-medium text-foreground underline underline-offset-4 hover:text-primary-text"
                  >
                    {t("learnMore")}
                  </Link>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleAcceptAnalytics}
                className="h-9 rounded-xl text-xs"
              >
                {t("accept")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleEssentialOnly}
                className="h-9 rounded-xl text-xs"
              >
                {t("reject")}
              </Button>
            </div>

            <button
              type="button"
              onClick={handleOpenPreferences}
              className="mx-auto cursor-pointer text-[11px] font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {t("managePrefs")}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

export function CookiePreferencesButton({
  className,
}: {
  readonly className?: string;
}) {
  const t = useTranslations("Legal.cookieBanner");
  return (
    <button
      type="button"
      onClick={openCookiePreferences}
      className={cn(
        "cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
        className,
      )}
    >
      {t("prefsTitle")}
    </button>
  );
}

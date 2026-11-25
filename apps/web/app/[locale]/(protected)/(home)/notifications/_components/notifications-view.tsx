"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  Bell,
  BellOff,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  HandCoins,
  Layers,
  Repeat,
  Send,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, SectionHeader } from "@/components/finance";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Link } from "@/i18n/navigation";
import {
  detectPushSupport,
  getBrowserTimeZone,
  getCurrentPushSubscription,
  subscribeDeviceToPush,
  unsubscribeDeviceFromPush,
  type PushSupportState,
} from "@/lib/push-client";
import { trpc } from "@app/api/client";

const TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const ADVANCE_OPTIONS = [0, 1, 2, 3, 5, 7, 14] as const;

const COMMON_TIMEZONES = [
  "America/El_Salvador",
  "America/Guatemala",
  "America/Costa_Rica",
  "America/Tegucigalpa",
  "America/Managua",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Panama",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Argentina/Buenos_Aires",
  "America/Santiago",
  "America/Sao_Paulo",
  "Europe/Madrid",
  "Europe/London",
  "UTC",
];

function formatTimeLabel(slot: string, locale: string): string {
  const [hStr, mStr] = slot.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const d = new Date(Date.UTC(2026, 0, 1, h, m));
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-SV", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return slot;
  }
}

function formatDateTime(iso: string, timeZone: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-SV", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function NotificationsView() {
  const t = useTranslations("Notifications");
  const locale = useLocale() === "en" ? "en" : "es";
  const utils = trpc.useUtils();

  const statusQuery = trpc.notifications.status.useQuery();
  const previewQuery = trpc.notifications.preview.useQuery({ locale });

  const updatePrefs = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => {
      void utils.notifications.status.invalidate();
      void utils.notifications.preview.invalidate();
      toast.success(t("schedule.savedToast"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const subscribeMut = trpc.notifications.subscribe.useMutation({
    onSuccess: () => {
      void utils.notifications.status.invalidate();
    },
  });

  const unsubscribeMut = trpc.notifications.unsubscribe.useMutation({
    onSuccess: () => {
      void utils.notifications.status.invalidate();
    },
  });

  const sendTestMut = trpc.notifications.sendTest.useMutation({
    onSuccess: (res) => {
      if (res.sent > 0) {
        toast.success(t("device.testSentToast", { count: String(res.sent) }));
      } else {
        toast.error(t("device.testNoneToast"));
      }
      void utils.notifications.status.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [support, setSupport] = useState<PushSupportState>("supported");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [browserTz, setBrowserTz] = useState("America/El_Salvador");

  useEffect(() => {
    const detected = detectPushSupport();
    setSupport(detected);
    setBrowserTz(getBrowserTimeZone());
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
    if (detected === "supported") {
      void getCurrentPushSubscription().then((sub) => {
        setCurrentEndpoint(sub?.endpoint ?? null);
      });
    }
  }, []);

  const data = statusQuery.data;
  const prefs = data?.preferences;
  const subs = data?.subscriptions ?? [];

  const isThisDeviceSubscribed = useMemo(() => {
    if (!currentEndpoint) return false;
    return subs.some((s) => s.endpoint === currentEndpoint);
  }, [currentEndpoint, subs]);

  const timezoneOptions = useMemo(() => {
    const set = new Set(COMMON_TIMEZONES);
    if (browserTz) set.add(browserTz);
    if (prefs?.timezone) set.add(prefs.timezone);
    return [...set];
  }, [browserTz, prefs?.timezone]);

  async function handleEnableDevice() {
    if (!data?.vapidPublicKey) return;
    setDeviceBusy(true);
    try {
      const serialized = await subscribeDeviceToPush(data.vapidPublicKey);
      setPermission(Notification.permission);
      setCurrentEndpoint(serialized.endpoint);
      await subscribeMut.mutateAsync({
        endpoint: serialized.endpoint,
        keys: serialized.keys,
        userAgent: navigator.userAgent,
        timezone: getBrowserTimeZone(),
        locale,
      });
      toast.success(t("device.enabledToast"));
    } catch (err) {
      if (typeof window !== "undefined" && "Notification" in window) {
        setPermission(Notification.permission);
      }
      const msg = err instanceof Error ? err.message : "";
      if (msg === "PERMISSION_DENIED") {
        toast.error(t("device.permissionDeniedTitle"));
      } else if (msg !== "PERMISSION_DISMISSED") {
        toast.error(msg || "Error");
      }
    } finally {
      setDeviceBusy(false);
    }
  }

  async function handleDisableDevice() {
    setDeviceBusy(true);
    try {
      const endpoint = await unsubscribeDeviceFromPush();
      const targetEndpoint = endpoint ?? currentEndpoint;
      setCurrentEndpoint(null);
      if (targetEndpoint) {
        await unsubscribeMut.mutateAsync({ endpoint: targetEndpoint });
      }
      toast.success(t("device.disabledToast"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setDeviceBusy(false);
    }
  }

  async function handleRemoveSubscription(id: string, endpoint: string) {
    try {
      if (endpoint === currentEndpoint) {
        await unsubscribeDeviceFromPush().catch(() => {});
        setCurrentEndpoint(null);
      }
      await unsubscribeMut.mutateAsync({ id });
      toast.success(t("devices.removedToast"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  const previewItems = previewQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 px-5 pt-2 lg:px-0">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        back="/"
        className="px-0"
      />

      {/* 1. Live pending preview */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionHeader title={t("preview.sectionTitle")} />
          {previewItems.length > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {t("preview.count", { count: String(previewItems.length) })}
            </Badge>
          )}
        </div>

        <Card variant="plain" className="overflow-hidden">
          {previewQuery.isLoading ? (
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : previewItems.length === 0 ? (
            <div className="flex items-center gap-3 p-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("preview.emptyTitle")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("preview.emptyDesc", {
                    days: String(prefs?.advanceDays ?? 3),
                  })}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {previewItems.map((item) => {
                const Icon =
                  item.kind === "card_payment"
                    ? CreditCard
                    : item.kind === "card_cutoff"
                      ? CalendarClock
                      : item.kind === "recurring"
                        ? Repeat
                        : item.kind === "debt"
                          ? HandCoins
                          : Layers;
                const isUrgent = item.dueInDays !== null && item.dueInDays <= 1;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                  >
                    <div
                      className={
                        isUrgent
                          ? "grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400"
                          : "grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"
                      }
                    >
                      <Icon className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {item.title}
                        </p>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] font-normal"
                        >
                          {t(`preview.kinds.${item.kind}`)}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.subtitle}
                      </p>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      {/* 2. This device push status */}
      <section className="flex flex-col gap-3">
        <SectionHeader title={t("device.sectionTitle")} />

        {statusQuery.isLoading ? (
          <Card variant="plain" className="p-4">
            <Skeleton className="h-14 w-full" />
          </Card>
        ) : !data?.configured ? (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>{t("device.notConfiguredTitle")}</AlertTitle>
            <AlertDescription>{t("device.notConfiguredDesc")}</AlertDescription>
          </Alert>
        ) : support === "ios_needs_install" ? (
          <Alert>
            <Smartphone className="size-4" />
            <AlertTitle>{t("device.iosTitle")}</AlertTitle>
            <AlertDescription>{t("device.iosDesc")}</AlertDescription>
          </Alert>
        ) : support === "insecure_context" ? (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>{t("device.insecureTitle")}</AlertTitle>
            <AlertDescription>{t("device.insecureDesc")}</AlertDescription>
          </Alert>
        ) : support === "unsupported" ? (
          <Alert>
            <BellOff className="size-4" />
            <AlertTitle>{t("device.unsupportedTitle")}</AlertTitle>
            <AlertDescription>{t("device.unsupportedDesc")}</AlertDescription>
          </Alert>
        ) : (
          <Card variant="plain" className="flex flex-col gap-4 p-4">
            <div className="flex items-start gap-3">
              <div
                className={
                  isThisDeviceSubscribed
                    ? "grid size-10 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
                    : "grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                }
              >
                {isThisDeviceSubscribed ? (
                  <BellRing className="size-5" aria-hidden />
                ) : (
                  <Bell className="size-5" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {isThisDeviceSubscribed
                    ? t("device.activeTitle")
                    : t("device.inactiveTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isThisDeviceSubscribed
                    ? t("device.activeDesc")
                    : t("device.inactiveDesc")}
                </p>
              </div>
            </div>

            {permission === "denied" && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>{t("device.permissionDeniedTitle")}</AlertTitle>
                <AlertDescription>
                  {t("device.permissionDeniedDesc")}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {isThisDeviceSubscribed ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sendTestMut.isPending}
                    onClick={() => sendTestMut.mutate({ locale })}
                  >
                    <Send className="size-3.5" aria-hidden />
                    {sendTestMut.isPending
                      ? t("device.testing")
                      : t("device.testCta")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={deviceBusy}
                    onClick={handleDisableDevice}
                  >
                    {t("device.disableCta")}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={deviceBusy || permission === "denied"}
                  onClick={handleEnableDevice}
                >
                  <BellRing className="size-3.5" aria-hidden />
                  {deviceBusy ? t("device.enabling") : t("device.enableCta")}
                </Button>
              )}
            </div>
          </Card>
        )}
      </section>

      {/* 3. Daily schedule */}
      {prefs && (
        <section className="flex flex-col gap-3">
          <SectionHeader title={t("schedule.sectionTitle")} />
          <Card variant="plain" className="divide-y overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {t("schedule.enabledLabel")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("schedule.enabledDesc")}
                </p>
              </div>
              <Switch
                checked={prefs.enabled}
                disabled={updatePrefs.isPending}
                onCheckedChange={(checked) =>
                  updatePrefs.mutate({
                    enabled: checked,
                    timezone: prefs.timezone || browserTz,
                    locale,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <label htmlFor="notif-time" className="text-sm font-medium">
                {t("schedule.timeLabel")}
              </label>
              <NativeSelect
                id="notif-time"
                size="sm"
                value={prefs.dailyTime}
                disabled={updatePrefs.isPending}
                onChange={(e) =>
                  updatePrefs.mutate({ dailyTime: e.target.value, locale })
                }
              >
                {TIME_SLOTS.map((slot) => (
                  <NativeSelectOption key={slot} value={slot}>
                    {formatTimeLabel(slot, locale)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <label htmlFor="notif-advance" className="text-sm font-medium">
                {t("schedule.advanceLabel")}
              </label>
              <NativeSelect
                id="notif-advance"
                size="sm"
                value={String(prefs.advanceDays)}
                disabled={updatePrefs.isPending}
                onChange={(e) =>
                  updatePrefs.mutate({
                    advanceDays: Number(e.target.value),
                    locale,
                  })
                }
              >
                {ADVANCE_OPTIONS.map((days) => (
                  <NativeSelectOption key={days} value={String(days)}>
                    {days === 0
                      ? t("schedule.advanceSameDay")
                      : t("schedule.advanceDays", { days })}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <label htmlFor="notif-tz" className="text-sm font-medium">
                {t("schedule.timezoneLabel")}
              </label>
              <NativeSelect
                id="notif-tz"
                size="sm"
                className="max-w-[200px]"
                value={prefs.timezone}
                disabled={updatePrefs.isPending}
                onChange={(e) =>
                  updatePrefs.mutate({ timezone: e.target.value, locale })
                }
              >
                {timezoneOptions.map((tz) => (
                  <NativeSelectOption key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("schedule.quietLabel")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("schedule.quietDesc")}
                </p>
              </div>
              <Switch
                checked={prefs.quietIfEmpty}
                disabled={updatePrefs.isPending}
                onCheckedChange={(checked) =>
                  updatePrefs.mutate({ quietIfEmpty: checked, locale })
                }
              />
            </div>

            {prefs.enabled && prefs.nextRunAt && (
              <div className="bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
                {t("schedule.nextRun", {
                  when: formatDateTime(prefs.nextRunAt, prefs.timezone, locale),
                })}
              </div>
            )}
          </Card>
        </section>
      )}

      {/* 4. Notification types */}
      {prefs && (
        <section className="flex flex-col gap-3">
          <SectionHeader title={t("types.sectionTitle")} />
          <Card variant="plain" className="divide-y overflow-hidden">
            {[
              {
                key: "notifyCardPayments" as const,
                icon: CreditCard,
                title: t("types.cardPayments"),
                desc: t("types.cardPaymentsDesc"),
                checked: prefs.notifyCardPayments,
              },
              {
                key: "notifyCardCutoffs" as const,
                icon: CalendarClock,
                title: t("types.cardCutoffs"),
                desc: t("types.cardCutoffsDesc"),
                checked: prefs.notifyCardCutoffs,
              },
              {
                key: "notifyRecurrings" as const,
                icon: Repeat,
                title: t("types.recurrings"),
                desc: t("types.recurringsDesc"),
                checked: prefs.notifyRecurrings,
              },
              {
                key: "notifyDebts" as const,
                icon: HandCoins,
                title: t("types.debts"),
                desc: t("types.debtsDesc"),
                checked: prefs.notifyDebts,
              },
              {
                key: "notifyInstallments" as const,
                icon: Layers,
                title: t("types.installments"),
                desc: t("types.installmentsDesc"),
                checked: prefs.notifyInstallments,
              },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-4 px-4 py-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{row.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.desc}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={row.checked}
                    disabled={updatePrefs.isPending}
                    onCheckedChange={(checked) =>
                      updatePrefs.mutate({ [row.key]: checked, locale })
                    }
                  />
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {/* 5. Connected devices */}
      <section className="flex flex-col gap-3">
        <SectionHeader title={t("devices.sectionTitle")} />
        <Card variant="plain" className="divide-y overflow-hidden">
          {subs.length === 0 ? (
            <p className="px-4 py-3.5 text-sm text-muted-foreground">
              {t("devices.empty")}
            </p>
          ) : (
            subs.map((sub) => {
              const isCurrent = sub.endpoint === currentEndpoint;
              return (
                <div
                  key={sub.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Smartphone
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {sub.deviceLabel}
                        </p>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t("devices.thisDevice")}
                          </Badge>
                        )}
                      </div>
                      {sub.lastUsedAt && prefs && (
                        <p className="truncate text-xs text-muted-foreground">
                          {t("devices.lastActive", {
                            when: formatDateTime(
                              sub.lastUsedAt,
                              prefs.timezone,
                              locale,
                            ),
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("devices.remove")}
                    disabled={unsubscribeMut.isPending}
                    onClick={() => handleRemoveSubscription(sub.id, sub.endpoint)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })
          )}
        </Card>
      </section>
    </div>
  );
}

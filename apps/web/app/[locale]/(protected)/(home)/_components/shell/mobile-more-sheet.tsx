"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Building2,
  ChartNoAxesColumnIncreasing,
  ChartPie,
  HandCoins,
  LogOut,
  Repeat,
  Settings,
  Shield,
  Tag,
  User as UserIcon,
  Wallet,
  X,
} from "lucide-react";

import { Drawer as DrawerPrimitive } from "vaul";

import ThemeSwitcher from "@/components/common/theme-switcher";
import { NavRow, SectionHeader } from "@/components/finance";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePathname } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import type { ShellUser } from "./app-sidebar";

/**
 * Full-width mobile menu sheet toggled by the "More" tab in MobileTabBar.
 * Keeps the exact card-grouped layout of `/more` without triggering a route
 * transition or losing the user's current scroll position.
 */
export function MobileMoreSheet({
  open,
  onOpenChange,
  user,
  canAccessAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ShellUser;
  canAccessAdmin: boolean;
}) {
  const t = useTranslations("Shell");
  const pathname = usePathname();
  const pushedHistoryRef = useRef(false);
  const prevPathRef = useRef(pathname);

  // Close automatically when navigation finishes
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      if (open) {
        pushedHistoryRef.current = false;
        onOpenChange(false);
      }
    }
  }, [pathname, open, onOpenChange]);

  // Support mobile hardware/gesture Back button to close the sheet
  useEffect(() => {
    if (open && !pushedHistoryRef.current && typeof window !== "undefined") {
      window.history.pushState({ firecentMoreSheet: true }, "");
      pushedHistoryRef.current = true;
    }
    const onPopState = () => {
      if (!pushedHistoryRef.current) return;
      pushedHistoryRef.current = false;
      onOpenChange(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [open, onOpenChange]);

  function handleClose() {
    onOpenChange(false);
    if (pushedHistoryRef.current && typeof window !== "undefined") {
      pushedHistoryRef.current = false;
      window.history.back();
    }
  }

  function handleNavClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest("a");
    if (anchor) {
      // Clear history flag so navigation proceeds cleanly without history.back()
      pushedHistoryRef.current = false;
      onOpenChange(false);
    }
  }

  async function handleSignOut() {
    pushedHistoryRef.current = false;
    onOpenChange(false);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/auth/login";
        },
      },
    });
  }

  const initial = (user.name || user.email || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <DrawerPrimitive.Root
      open={open}
      direction="left"
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0b1220]/50 lg:hidden" />
        <DrawerPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex h-dvh w-full flex-col bg-background text-foreground outline-none lg:hidden"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-5 backdrop-blur-md">
            <DrawerPrimitive.Title className="text-[18px] font-semibold tracking-tight">
              {t("nav.more")}
            </DrawerPrimitive.Title>
            <Button
              type="button"
              variant="ghost"
              size="icon-touch"
              aria-label={t("close")}
              onClick={handleClose}
            >
              <X aria-hidden />
            </Button>
          </div>

          <div
            onClick={handleNavClick}
            className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-10"
          >
            <div className="space-y-6">
              {/* User & theme card */}
              <Card variant="plain" className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar size="md" color="PURPLE">
                    <AvatarImage src={user.image || ""} />
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-foreground">
                      {user.name || user.email}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>
                <ThemeSwitcher
                  variant="long"
                  className="w-full justify-between"
                />
              </Card>

              <section className="flex flex-col gap-3">
                <SectionHeader title={t("more.moneySection")} />
                <Card variant="plain" className="divide-y overflow-hidden">
                  <NavRow
                    icon={Wallet}
                    label={t("nav.accounts")}
                    href="/accounts"
                  />
                  <NavRow
                    icon={ChartPie}
                    label={t("nav.budget")}
                    href="/budget"
                  />
                  <NavRow
                    icon={ChartNoAxesColumnIncreasing}
                    label={t("nav.analytics")}
                    href="/analytics"
                  />
                  <NavRow
                    icon={Repeat}
                    label={t("nav.recurring")}
                    href="/recurring"
                  />
                  <NavRow
                    icon={HandCoins}
                    label={t("nav.debts")}
                    href="/debts"
                  />
                  <NavRow
                    icon={Tag}
                    label={t("nav.categories")}
                    href="/categories"
                  />
                </Card>
              </section>

              <section className="flex flex-col gap-3">
                <SectionHeader title={t("more.preferencesSection")} />
                <Card variant="plain" className="divide-y overflow-hidden">
                  <NavRow
                    icon={Settings}
                    label={t("nav.settings")}
                    href="/settings"
                  />
                  <NavRow
                    icon={Building2}
                    label={t("settings.membersAndSpace")}
                    href="/organization"
                  />
                  <NavRow
                    icon={UserIcon}
                    label={t("userMenu.profile")}
                    href="/profile"
                  />
                  {canAccessAdmin && (
                    <NavRow
                      icon={Shield}
                      label={t("userMenu.admin")}
                      href="/admin"
                    />
                  )}
                </Card>
              </section>

              <Button
                type="button"
                variant="outline"
                size="touch"
                onClick={handleSignOut}
                className="w-full rounded-2xl text-muted-foreground hover:text-destructive"
              >
                <LogOut className="size-4" aria-hidden />
                <span>{t("userMenu.signOut")}</span>
              </Button>
            </div>
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

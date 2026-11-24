"use client";

import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { SpaceSwitcher } from "./space-switcher";

const ROOT_PATHS = new Set(["/", "/transactions", "/assistant", "/more"]);

/**
 * Mobile root header (< 1024 px): Space selector (E1) + notification bell (E2).
 * Only rendered on root tabs; child screens render their own PageHeader with back.
 */
export function MobileTopBar() {
  const t = useTranslations("Shell");
  const pathname = usePathname();

  if (!ROOT_PATHS.has(pathname)) return null;

  return (
    <div className="mx-auto flex h-14 w-full max-w-[560px] items-center justify-between px-4 lg:hidden">
      <SpaceSwitcher variant="mobile" />
      <Button
        variant="ghost"
        size="icon-touch"
        nativeButton={false}
        aria-label={t("nav.notifications")}
        render={<Link href="/notifications" />}
      >
        <Bell aria-hidden />
      </Button>
    </div>
  );
}

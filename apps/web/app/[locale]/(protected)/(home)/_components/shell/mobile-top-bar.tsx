"use client";

import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";

import { FirecentMark } from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";

const ROOT_PATHS = new Set(["/", "/transactions", "/assistant", "/more"]);

/**
 * Mobile root header (< 1024 px): Firecent logo + notification bell (E2).
 * Only rendered on root tabs; child screens render their own PageHeader with back.
 */
export function MobileTopBar() {
  const t = useTranslations("Shell");
  const pathname = usePathname();

  if (!ROOT_PATHS.has(pathname)) return null;

  return (
    <div className="mx-auto flex h-14 w-full max-w-[560px] items-center justify-between pr-2.5 pl-5 lg:hidden">
      <Link
        href="/"
        aria-label="Firecent"
        className="inline-flex h-10 items-center rounded-xl text-foreground transition-opacity hover:opacity-85"
      >
        <FirecentMark variant="logo" className="h-8 w-auto" />
      </Link>
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

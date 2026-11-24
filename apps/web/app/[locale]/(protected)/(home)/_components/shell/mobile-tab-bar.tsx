"use client";

import { useTranslations } from "next-intl";
import { ArrowLeftRight, House, Menu, Plus } from "lucide-react";

import { FirecentMark } from "@/components/finance";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useShell } from "./shell-context";

const MORE_CHILD_PREFIXES = [
  "/more",
  "/accounts",
  "/budget",
  "/analytics",
  "/recurring",
  "/debts",
  "/settings",
  "/profile",
  "/organization",
  "/billing",
  "/invitations",
  "/notifications",
];

function isMoreActive(pathname: string) {
  return MORE_CHILD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Firecent E17 Mobile tab bar (< 1024 px).
 * Five slots: Home, Transactions, +, Assistant, More.
 * Hidden while the quick-add sheet is open.
 */
export function MobileTabBar() {
  const t = useTranslations("Shell");
  const pathname = usePathname();
  const { isAddOpen, openAddTransaction } = useShell();

  if (isAddOpen) return null;

  const homeActive = pathname === "/";
  const txActive =
    pathname === "/transactions" || pathname.startsWith("/transactions/");
  const assistantActive =
    pathname === "/assistant" || pathname.startsWith("/assistant/");
  const moreActive = isMoreActive(pathname);

  const tabClass = (active: boolean) =>
    cn(
      "flex h-14 flex-col items-center justify-center gap-1 text-[11px] transition-colors",
      active ? "font-semibold text-primary-text" : "font-medium text-muted-foreground",
    );

  return (
    <nav
      aria-label={t("navigation")}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/90 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto grid h-16 max-w-[560px] grid-cols-5 items-center px-2">
        <Link
          href="/"
          aria-current={homeActive ? "page" : undefined}
          className={tabClass(homeActive)}
        >
          <House className="size-[22px]" aria-hidden />
          <span>{t("nav.home")}</span>
        </Link>

        <Link
          href="/transactions"
          aria-current={txActive ? "page" : undefined}
          className={tabClass(txActive)}
        >
          <ArrowLeftRight className="size-[22px]" aria-hidden />
          <span>{t("nav.transactions")}</span>
        </Link>

        <div className="flex items-center justify-center">
          <button
            type="button"
            aria-label={t("addTransaction")}
            onClick={() => openAddTransaction()}
            className="-mt-4 grid size-13 place-items-center rounded-[20px] bg-primary text-primary-foreground shadow-[0_8px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)] transition-transform active:scale-95"
          >
            <Plus className="size-6" aria-hidden />
          </button>
        </div>

        <Link
          href="/assistant"
          aria-current={assistantActive ? "page" : undefined}
          className={tabClass(assistantActive)}
        >
          <FirecentMark
            variant={assistantActive ? "color" : "mono"}
            className="size-[22px]"
          />
          <span>{t("nav.assistant")}</span>
        </Link>

        <Link
          href="/more"
          aria-current={moreActive ? "page" : undefined}
          className={tabClass(moreActive)}
        >
          <Menu className="size-[22px]" aria-hidden />
          <span>{t("nav.more")}</span>
        </Link>
      </div>
    </nav>
  );
}

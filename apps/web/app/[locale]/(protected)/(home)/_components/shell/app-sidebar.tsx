"use client";

import { useTranslations } from "next-intl";
import {
  ArrowLeftRight,
  ChartNoAxesColumnIncreasing,
  ChartPie,
  HandCoins,
  House,
  LogOut,
  Plus,
  Repeat,
  Settings,
  Shield,
  User as UserIcon,
  Wallet,
} from "lucide-react";

import { FirecentMark } from "@/components/finance";
import ThemeSwitcher from "@/components/common/theme-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useShell } from "./shell-context";
import { SpaceSwitcher } from "./space-switcher";

export type ShellUser = {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
};

const PRIMARY_NAV = [
  { key: "home", href: "/", icon: House },
  { key: "transactions", href: "/transactions", icon: ArrowLeftRight },
  { key: "accounts", href: "/accounts", icon: Wallet },
  { key: "budget", href: "/budget", icon: ChartPie },
  { key: "analytics", href: "/analytics", icon: ChartNoAxesColumnIncreasing },
  { key: "recurring", href: "/recurring", icon: Repeat },
  { key: "debts", href: "/debts", icon: HandCoins },
] as const;

function isRouteActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({
  user,
  canAccessAdmin,
}: {
  user: ShellUser;
  canAccessAdmin: boolean;
}) {
  const t = useTranslations("Shell");
  const pathname = usePathname();
  const { openAddTransaction } = useShell();

  const initial = (user.name || user.email || "U").trim().charAt(0).toUpperCase();

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/auth/login";
        },
      },
    });
  }

  return (
    <aside
      aria-label={t("navigation")}
      className="hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-4 lg:flex"
    >
      {/* Space selector (E1) */}
      <div className="mb-3">
        <SpaceSwitcher variant="sidebar" />
      </div>

      {/* Primary violet CTA (SPEC §2.2 — the one violet action) */}
      <Button
        variant="default"
        size="touch"
        onClick={() => openAddTransaction()}
        className="mb-4 w-full justify-center shadow-[0_8px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)]"
      >
        <Plus className="size-[18px]" aria-hidden />
        <span>{t("addTransaction")}</span>
      </Button>

      {/* Main navigation */}
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {PRIMARY_NAV.map(({ key, href, icon: Icon }) => {
          const active = isRouteActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary-text"
                  : "text-sidebar-foreground/80 hover:bg-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className="truncate">{t(`nav.${key}`)}</span>
            </Link>
          );
        })}

        <div className="my-2 border-t" />

        <Link
          href="/assistant"
          aria-current={isRouteActive(pathname, "/assistant") ? "page" : undefined}
          className={cn(
            "flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors",
            isRouteActive(pathname, "/assistant")
              ? "bg-assistant text-assistant-accent"
              : "text-sidebar-foreground/80 hover:bg-accent hover:text-sidebar-foreground",
          )}
        >
          <FirecentMark variant="color" className="size-[18px] shrink-0" />
          <span className="truncate">{t("nav.assistant")}</span>
        </Link>
      </nav>

      {/* Bottom utility section */}
      <div className="mt-2 flex flex-col gap-1 border-t pt-3">
        <Link
          href="/settings"
          aria-current={
            isRouteActive(pathname, "/settings") ||
            isRouteActive(pathname, "/profile") ||
            isRouteActive(pathname, "/organization") ||
            isRouteActive(pathname, "/billing")
              ? "page"
              : undefined
          }
          className={cn(
            "flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors",
            isRouteActive(pathname, "/settings")
              ? "bg-primary/10 text-primary-text"
              : "text-sidebar-foreground/80 hover:bg-accent hover:text-sidebar-foreground",
          )}
        >
          <Settings className="size-[18px] shrink-0" aria-hidden />
          <span className="truncate">{t("nav.settings")}</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left transition-colors hover:bg-accent"
              >
                <Avatar size="md" color="PURPLE">
                  <AvatarImage src={user.image || ""} />
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {user.name || user.email}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </button>
            }
          />
          <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{user.name || user.email}</DropdownMenuLabel>
              <ThemeSwitcher variant="long" />
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/profile" />}>
                <UserIcon className="size-4" />
                <span>{t("userMenu.profile")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings" />}>
                <Settings className="size-4" />
                <span>{t("nav.settings")}</span>
              </DropdownMenuItem>
              {canAccessAdmin && (
                <DropdownMenuItem render={<Link href="/admin" />}>
                  <Shield className="size-4" />
                  <span>{t("userMenu.admin")}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="size-4" />
              <span>{t("userMenu.signOut")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

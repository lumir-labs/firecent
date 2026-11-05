"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, Sparkles, X } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import ThemeSwitcher from "@/components/common/theme-switcher";

export function LandingNavbar() {
  const t = useTranslations("Landing");
  const tCommon = useTranslations("Common");
  const [open, setOpen] = useState(false);

  const links = [
    { href: "#features", label: t("nav.features") },
    { href: "#how-it-works", label: t("nav.howItWorks") },
    { href: "#pricing", label: t("nav.pricing") },
    { href: "#faq", label: t("nav.faq") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/landing" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="text-base font-bold tracking-tight">
            {tCommon("appName")}
          </span>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {t("nav.logoSuffix")}
          </Badge>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <LanguageSwitcher />
          <ThemeSwitcher />
          <Link
            href="/auth/login"
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            {t("nav.login")}
          </Link>
          <Link
            href="/auth/login"
            className={cn(buttonVariants({ variant: "default" }))}
          >
            {t("nav.start")}
          </Link>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <LanguageSwitcher />
          <ThemeSwitcher />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen((v) => !v)}
            aria-label="menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t bg-background px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex gap-2">
            <Link
              href="/auth/login"
              className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
            >
              {t("nav.login")}
            </Link>
            <Link
              href="/auth/login"
              className={cn(buttonVariants({ variant: "default" }), "flex-1")}
            >
              {t("nav.start")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

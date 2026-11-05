"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export default function ThemeSwitcher({
  variant = "short",
  className,
}: {
  variant?: "short" | "long";
  className?: string;
}) {
  const t = useTranslations("Common");
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // next-themes doesn't resolve the theme during SSR/first paint: without this
  // gate, the server renders with theme undefined and the client with the real
  // theme => className mismatch on the buttons => hydration error (Next 16
  // hard-fails).
  useEffect(() => {
    setMounted(true);
  }, []);

  const themes = [
    { value: "light", label: t("theme.light"), icon: Sun },
    { value: "dark", label: t("theme.dark"), icon: Moon },
    { value: "system", label: t("theme.system"), icon: Monitor },
  ];
  return (
    <>
      {variant === "short" ? (
        <Button
          type="button"
          variant="ghost"
          className={cn("h-8 w-8 p-0", className)}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <span className="sr-only">{t("theme.openMenu")}</span>
          {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : null}
          {mounted && theme !== "dark" ? <Moon className="h-4 w-4" /> : null}
          {!mounted ? <span className="h-4 w-4" /> : null}
        </Button>
      ) : (
        <div
          className={cn("inline-flex p-1 bg-muted rounded-lg gap-1", className)}
        >
          {mounted ? (
            themes.map((t) => {
              const Icon = t.icon;
              const active = theme === t.value;
              return (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={cn(
                    "relative flex items-center gap-2 px-3 py-0.5 rounded-md text-sm transition-all",
                    active
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </button>
              );
            })
          ) : (
            // Stable placeholder during SSR: same markup, no theme state.
            // Avoids the server/client mismatch without the user seeing an odd flash.
            <div className="inline-flex gap-1" aria-hidden />
          )}
        </div>
      )}
    </>
  );
}

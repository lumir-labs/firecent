"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

export default function ThemeSwitcher({
  variant = "short",
  className,
}: {
  variant?: "short" | "long" | "compact";
  className?: string;
}) {
  const t = useTranslations("Common");
  // next-themes doesn't resolve the theme during SSR/first paint: without this
  // gate, the server renders with theme undefined and the client with the real
  // theme => className mismatch on the buttons => hydration error (Next 16
  // hard-fails).
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: "light", label: t("theme.light"), icon: Sun },
    { value: "dark", label: t("theme.dark"), icon: Moon },
    { value: "system", label: t("theme.system"), icon: Monitor },
  ];

  if (variant === "short") {
    return (
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
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "grid w-full grid-cols-3 gap-1 rounded-xl bg-muted p-1",
          className,
        )}
      >
        {mounted ? (
          themes.map((item) => {
            const Icon = item.icon;
            const active = theme === item.value;
            return (
              <button
                type="button"
                key={item.value}
                aria-pressed={active}
                onClick={() => setTheme(item.value)}
                className={cn(
                  "flex h-7 min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 text-[12px] font-medium transition-all",
                  active
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })
        ) : (
          <div className="col-span-3 h-7" aria-hidden />
        )}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex gap-1 rounded-lg bg-muted p-1", className)}>
      {mounted ? (
        themes.map((item) => {
          const Icon = item.icon;
          const active = theme === item.value;
          return (
            <button
              type="button"
              key={item.value}
              aria-pressed={active}
              onClick={() => setTheme(item.value)}
              className={cn(
                "relative flex items-center gap-2 rounded-md px-3 py-0.5 text-sm transition-all",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })
      ) : (
        // Stable placeholder during SSR: same markup, no theme state.
        // Avoids the server/client mismatch without the user seeing an odd flash.
        <div className="inline-flex gap-1" aria-hidden />
      )}
    </div>
  );
}

import { Sparkles } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Separator } from "@/components/ui/separator";

import { getTranslations } from "next-intl/server";

export async function LandingFooter() {
  const t = await getTranslations("Landing");
  const tCommon = await getTranslations("Common");

  const columns = [
    {
      title: t("footer.product"),
      links: [
        { href: "#features", label: t("nav.features") },
        { href: "#pricing", label: t("nav.pricing") },
        { href: "#faq", label: t("nav.faq") },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { href: "/landing", label: t("nav.logoSuffix") },
        { href: "/auth/login", label: t("nav.login") },
        { href: "/", label: "Dashboard" },
      ],
    },
    {
      title: t("footer.resources"),
      links: [
        { href: "/api-docs", label: "API Docs" },
        { href: "#how-it-works", label: t("nav.howItWorks") },
        { href: "/landing", label: "Demo" },
      ],
    },
  ];

  return (
    <footer className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              <span className="text-base font-bold">{tCommon("appName")}</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="text-sm font-semibold">{col.title}</p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {col.links.map((link) =>
                    link.href.startsWith("#") ? (
                      <li key={`${col.title}-${link.label}`}>
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          {link.label}
                        </a>
                      </li>
                    ) : (
                      <li key={`${col.title}-${link.label}`}>
                        <Link
                          href={link.href as "/auth/login"}
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <Separator className="my-8" />
        <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} {tCommon("appName")} · {t("footer.rights")}</p>
          <p>{t("footer.madeWith")}</p>
        </div>
      </div>
    </footer>
  );
}

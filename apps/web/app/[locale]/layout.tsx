import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { locale } from "next/root-params";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Merriweather, Fira_Code, Inter } from "next/font/google";

import { routing } from "@/i18n/routing";
import { isLocale } from "@/i18n/utils";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/providers/theme-provider";

import "../globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const merriweather = Merriweather({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const firaCode = Fira_Code({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    template: "App | %s",
    default: "App | Boilerplate",
  },
  description: "App boilerplate",
  icons: {
    icon: [
      { url: "/splash/app-icons/favicon.svg", type: "image/svg+xml" },
      { url: "/splash/app-icons/favicon.ico", sizes: "any" },
      { url: "/splash/app-icons/favicon_32.png", sizes: "32x32", type: "image/png" },
      { url: "/splash/app-icons/favicon_64.png", sizes: "64x64", type: "image/png" },
      { url: "/splash/app-icons/favicon_256.png", sizes: "256x256", type: "image/png" },
    ],
    shortcut: "/splash/app-icons/favicon.ico",
    apple: [
      { url: "/splash/app-icons/app_dark_180.png", sizes: "180x180", type: "image/png" },
    ],
    other: [{ rel: "mask-icon", url: "/splash/icon.svg", color: "#ff7a3d" }],
  },
  manifest: "/site.webmanifest",
};

// `og:logo` uses `property=` (OpenGraph), which `metadata.other` can't emit
// (it renders `name=`). React 19 hoists this <meta> into <head>.
const OG_LOGO_URL = "https://firecent.app/splash/logo.png";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
};

export default async function LocaleLayout({ children }: Props) {
  // Root param (Next 16.3+): no param prop-drilling, valid for static rendering.
  const localeValue = await locale();

  if (!isLocale(localeValue)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html
      lang={localeValue}
      className={cn(inter.variable, merriweather.variable, firaCode.variable)}
      suppressHydrationWarning
    >
      <body className="font-geist-sans antialiased">
        <meta property="og:logo" content={OG_LOGO_URL} />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <Toaster richColors />
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

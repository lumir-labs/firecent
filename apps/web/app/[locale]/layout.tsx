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
};

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
      <link rel="icon" href="/icon.png" type="image/png" sizes="any" />
      <link rel="apple-touch-icon" href="/icon.png" />
      <body className="font-geist-sans antialiased">
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

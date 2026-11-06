import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { locale } from "next/root-params";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Merriweather, Fira_Code, Inter } from "next/font/google";

import { routing, type Locale } from "@/i18n/routing";
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

// Production origin: OG/Twitter images must be absolute URLs crawlers can reach,
// so this stays on the public domain even in local dev.
const SITE_URL = "https://firecent.app";
const SITE_NAME = "firecent";
// English is the default image (also used by the static splash at `/`);
// Spanish routes get their own copy.
const OG_IMAGE_PATHS: Record<Locale, string> = {
  en: "/splash/og-image.png",
  es: "/splash/og-image-es.png",
};
const OG_IMAGE = {
  width: 1200,
  height: 630,
  type: "image/png",
};

// Open Graph locale per route locale (`og:locale` expects language_TERRITORY).
const OG_LOCALES: Record<Locale, string> = { es: "es_ES", en: "en_US" };

const ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

const STATIC_METADATA = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  referrer: "strict-origin-when-cross-origin",
  keywords: [
    "firecent",
    "finanzas personales",
    "gastos compartidos",
    "dividir gastos",
    "metas de ahorro",
    "app de finanzas",
    "personal finance",
    "shared expenses",
    "savings goals",
  ],
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  robots: ROBOTS,
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
} satisfies Metadata;

// Site-wide SEO, localized per route locale. No `canonical` or `hreflang` here
// on purpose: root-layout metadata is inherited by every page, so those would
// point all routes at the same URL. Set them per page instead.
export async function generateMetadata(): Promise<Metadata> {
  const localeValue = await locale();
  if (!isLocale(localeValue)) return STATIC_METADATA;

  const t = await getTranslations({ locale: localeValue, namespace: "Seo" });
  const ogImage = {
    ...OG_IMAGE,
    url: OG_IMAGE_PATHS[localeValue],
    alt: t("ogImageAlt"),
  };

  return {
    ...STATIC_METADATA,
    title: {
      template: `%s | ${SITE_NAME}`,
      default: t("title"),
    },
    description: t("description"),
    openGraph: {
      type: "website",
      // Locale home. Inherited by every page: override `openGraph` per page
      // when a page needs its own share URL.
      url: `/${localeValue}`,
      siteName: SITE_NAME,
      title: t("ogTitle"),
      description: t("description"),
      locale: OG_LOCALES[localeValue],
      alternateLocale: routing.locales
        .filter((l) => l !== localeValue)
        .map((l) => OG_LOCALES[l]),
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("description"),
      images: [ogImage],
    },
  };
}

function siteJsonLd(description: string, slogan: string, inLanguage: Locale) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: {
          "@type": "ImageObject",
          "@id": `${SITE_URL}/#logo`,
          url: OG_LOGO_URL,
          width: 1102,
          height: 384,
          caption: SITE_NAME,
        },
        image: `${SITE_URL}${OG_IMAGE_PATHS[inLanguage]}`,
        slogan,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        description,
        inLanguage,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };
}

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
  const tSeo = await getTranslations({ locale: localeValue, namespace: "Seo" });
  // Escape `<` so message text can never close the <script> tag.
  const jsonLd = JSON.stringify(
    siteJsonLd(tSeo("description"), tSeo("slogan"), localeValue),
  ).replace(/</g, "\\u003c");

  return (
    <html
      lang={localeValue}
      className={cn(inter.variable, merriweather.variable, firaCode.variable)}
      suppressHydrationWarning
    >
      <body className="font-geist-sans antialiased">
        <meta property="og:logo" content={OG_LOGO_URL} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
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

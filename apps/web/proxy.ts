import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { getServerSession } from "@/lib/auth";
import { routing, stripLocalePrefix } from "@/i18n/routing";
import {
  apiAuthPrefix,
  publicRoutes,
  authRoutes,
  DEFAULT_LOGIN_REDIRECT,
} from "./routes";

const handleI18nRouting = createMiddleware(routing);

function getLocaleFromPathname(pathname: string): string {
  const maybeLocale = pathname.split("/")[1];
  if (
    maybeLocale &&
    (routing.locales as readonly string[]).includes(maybeLocale)
  ) {
    return maybeLocale;
  }
  return routing.defaultLocale;
}

export async function proxy(request: NextRequest) {
  const nextUrl = request.nextUrl;

  // Production root: serve the static brand page (public/splash/index.html).
  // The rewrite keeps the browser at "/". Only the exact root is affected:
  // locale paths (/es, /en) and the rest of the app behave as before.
  if (process.env.NODE_ENV === "production" && nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/splash/index.html", request.url));
  }

  // 1. API routes and OpenAPI spec: outside the locale, no i18n.
  // `/openapi.json` is a static file in `public/` that the `/api-docs` viewer
  // fetches directly: if it goes through i18n it gets rewritten to
  // `/es/openapi.json` and auth redirects it to the login page (HTML), which
  // makes Scalar fail with
  // "Document could not be loaded".
  const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
  const isTrpcRoute = nextUrl.pathname.startsWith("/api/trpc");
  const isInfoRoute = nextUrl.pathname.startsWith("/api/v1/info");
  const isWaitlistRoute = nextUrl.pathname.startsWith("/api/v1/waitlist");
  const isMcpRoute = nextUrl.pathname.startsWith("/api/mcp");
  const isOpenApiSpec =
    nextUrl.pathname === "/openapi.json" ||
    stripLocalePrefix(nextUrl.pathname) === "/openapi.json";
  const isApiRoute = nextUrl.pathname.startsWith("/api");

  if (isOpenApiSpec) {
    // Public spec for the API docs viewer: serve without i18n or auth.
    return NextResponse.next();
  }

  if (isApiAuthRoute || isInfoRoute || isWaitlistRoute || isMcpRoute) {
    // `/api/mcp*` is let through: authentication is done by the MCP server
    // per org API key on each request (§5.3), not by the session cookie.
    return NextResponse.next();
  }

  if (isTrpcRoute) {
    const session = await getServerSession();
    if (session) return NextResponse.next();
    return NextResponse.json(
      { success: false, error: "No session provided" },
      { status: 401 },
    );
  }

  if (isApiRoute) {
    // Explicit allowlist (§5.3): future endpoints under `/api` are
    // closed by default instead of open.
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  // 2. i18n routing: redirects /x -> /<locale>/x, negotiates
  // Accept-Language + cookie (default locale: "en").
  const i18nResponse = handleI18nRouting(request);

  // If it's a redirect (307/308) or a rewrite with locale, return it directly.
  // The next request to /<locale>/... will go through the auth below.
  const location = i18nResponse.headers.get("location");
  if (location || i18nResponse.status === 307 || i18nResponse.status === 308) {
    return i18nResponse;
  }
  // next-intl can also rewrite / -> /<default-locale> via x-middleware-rewrite.
  // In that case we continue with auth using the rewritten pathname.
  const rewrite = i18nResponse.headers.get("x-middleware-rewrite");
  const effectivePathname = rewrite
    ? new URL(rewrite, nextUrl).pathname
    : nextUrl.pathname;

  // If there was an internal rewrite, propagate its headers (includes
  // x-next-intl-locale). We apply them to the final auth response below.

  // 3. Auth over the path WITHOUT the locale prefix.
  const pathnameWithoutLocale = stripLocalePrefix(effectivePathname);
  const locale = getLocaleFromPathname(effectivePathname);

  const session = await getServerSession();

  const isPublicRoute = publicRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route),
  );
  const searchParams = nextUrl.searchParams.toString();
  // callbackUrl without prefix: the localized router re-adds it by itself.
  const rawCallback = searchParams
    ? `${pathnameWithoutLocale}?${searchParams}`
    : pathnameWithoutLocale;
  const callbackUrl = encodeURIComponent(rawCallback);

  const isAuthRoute = authRoutes.includes(pathnameWithoutLocale);
  const isLoggedIn = !!session;

  const withI18nHeaders = (res: NextResponse) => {
    // Propagates the locale negotiated by next-intl to the final response.
    const requestLocale = i18nResponse.headers.get("x-next-intl-locale");
    if (requestLocale) res.headers.set("x-next-intl-locale", requestLocale);
    const cookie = i18nResponse.headers.get("set-cookie");
    if (cookie) res.headers.set("set-cookie", cookie);
    return res;
  };

  if (isAuthRoute) {
    if (!isLoggedIn) return withI18nHeaders(NextResponse.next());
    return withI18nHeaders(
      NextResponse.redirect(
        new URL(`/${locale}${DEFAULT_LOGIN_REDIRECT}`, nextUrl),
      ),
    );
  }

  if (!isLoggedIn && !isPublicRoute) {
    if (
      pathnameWithoutLocale === DEFAULT_LOGIN_REDIRECT ||
      pathnameWithoutLocale === "/"
    ) {
      return withI18nHeaders(
        NextResponse.redirect(new URL(`/${locale}/auth/login`, nextUrl)),
      );
    }
    return withI18nHeaders(
      NextResponse.redirect(
        new URL(`/${locale}/auth/login?callbackUrl=${callbackUrl}`, nextUrl),
      ),
    );
  }

  return withI18nHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

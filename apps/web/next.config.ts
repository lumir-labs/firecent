import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// A single `.env` at the monorepo root as the canonical source for hosting.
// - Next.js only reads `apps/web/.env*` by default: here we additionally load
//   `<root>/.env` as a fallback to avoid duplicating secrets.
// - `process.loadEnvFile` (Node 20.12+, Bun) does NOT override already-defined
//   variables: those from the hosting/panel and from `apps/web/.env*` always win.
//   This prevents leaks from accidental overwriting.
try {
  process.loadEnvFile(path.resolve(import.meta.dirname ?? ".", "..", "..", ".env"));
} catch {
  // No root `.env` (e.g. hosting that injects variables directly):
  // do nothing, `process.env` already has what's needed.
}

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./i18n/request.ts",
  experimental: {
    createMessagesDeclaration: "./messages/es.json",
  },
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@prisma/client"],
  /* config options here */
  allowedDevOrigins: ["192.168.1.46"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    // Hardening baseline for the boilerplate (adjust the CSP to your domains).
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data: https:",
              "connect-src 'self' https:",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

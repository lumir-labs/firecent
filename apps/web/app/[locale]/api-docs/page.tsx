"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";

import "@scalar/api-reference-react/style.css";

export default function ApiDocsPage() {
  return (
    <ApiReferenceReact
      configuration={{
        // `sources` (not the deprecated top-level `url`): with an explicit
        // title so it doesn't show "unknown", and a stable document slug.
        // The spec is the static `public/openapi.json` (generated with
        // `bun run generate:openapi`): it is served without i18n or auth (see
        // `proxy.ts`) so the viewer's fetch receives JSON, not the login.
        sources: [
          {
            title: "app API",
            slug: "api",
            url: "/openapi.json",
          },
        ],
      }}
    />
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import React, { useState } from "react";
import * as SecureStore from "expo-secure-store";
import { trpc } from "@app/api/client";
import { getApiBaseUrl } from "./api-base-url";
import { buildCookieHeader } from "./cookies";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({ enabled: () => __DEV__ }),
        httpBatchLink({
          url: `${getApiBaseUrl()}/api/trpc`,
          async headers() {
            try {
              // Same key as the expoClient's `storagePrefix` in auth-client.
              const raw = await SecureStore.getItemAsync("stackgoat_cookie");
              const cookie = buildCookieHeader(raw);
              return cookie ? { cookie } : {};
            } catch {
              return {};
            }
          },
          fetch(url, opts) {
            return fetch(url, { ...opts, credentials: "include" });
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

export { trpc };

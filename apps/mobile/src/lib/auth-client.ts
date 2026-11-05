import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { magicLinkClient, twoFactorClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import { getApiBaseUrl } from "./api-base-url";

const SCHEME = "stackgoat";

export const authClient = createAuthClient({
  // Same base as tRPC (see api-base-url.ts); without env it falls back to
  // localhost with a warning, never to a hardcoded personal IP.
  baseURL: getApiBaseUrl(),
  plugins: [
    expoClient({
      scheme: SCHEME,
      storagePrefix: SCHEME,
      storage: SecureStore,
    }),
    // Types `signIn.magicLink` on the client (same plugin as the web).
    magicLinkClient(),
    // 2FA TOTP step (mirror of the web `login-form.tsx`): enables
    // `authClient.twoFactor.verifyTotp/verifyBackupCode` on native.
    twoFactorClient(),
  ],
});

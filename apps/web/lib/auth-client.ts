import { createAuthClient } from "better-auth/react";
import {
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { toast } from "sonner";

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), organizationClient(), twoFactorClient()],
  fetchOptions: {
    onError: async () => {
      toast.error("An error occurred while connecting to the server.");
    },
  },
});

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, type Context } from "@app/api";
import { getServerSession } from "@/lib/auth";
import { getSessionOrganization } from "@/lib/actions/organization";

async function createContext(): Promise<Context> {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { orgId: null, session: null };
    }

    const org = await getSessionOrganization();
    const orgId = org?.OrganizationId ?? null;
    return { orgId, session };
  } catch {
    return { orgId: null, session: null };
  }
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };

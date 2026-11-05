import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { acceptInvitation } from "@/lib/actions/invitations";

type Props = {
  searchParams: Promise<{ id?: string }>;
};

/**
 * Organization invitation acceptance (email link, 48 h).
 * Lives under `(protected)`: without a session the proxy sends to login with
 * a callback and it is accepted upon return. The plugin validates ownership
 * by email and validity window.
 */
export default async function AcceptPage({ searchParams }: Props) {
  const tPortal = await getTranslations("Portal");
  const { id } = await searchParams;

  if (!id) {
    redirect("/");
  }

  const result = await acceptInvitation(id);
  if (!result.error) {
    redirect("/");
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>{tPortal("invites.acceptTitle")}</CardTitle>
          <CardDescription>{result.error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" className={buttonVariants({ variant: "default" })}>
            {tPortal("invites.goDashboard")}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

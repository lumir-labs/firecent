import { getTranslations } from "next-intl/server";
import { CreditCard } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

const PLANS = ["starter", "pro", "enterprise"] as const;

export default async function Page() {
  const tPortal = await getTranslations("Portal");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{tPortal("billingTitle")}</h1>
        <p className="text-muted-foreground text-sm">{tPortal("billingDesc")}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {tPortal("currentPlan")}
          </CardTitle>
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CreditCard className="size-4" />
          </span>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <p className="text-xl font-extrabold tracking-tight">
              {tPortal("noPlan")}
            </p>
            <Badge variant="secondary">—</Badge>
          </div>
          {/* TODO(stripe): slot for the payments integration (checkout + customer portal). */}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tPortal("plansTitle")}</CardTitle>
          <CardDescription>{tPortal("plansDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan}
              className="flex flex-col gap-2 rounded-lg border px-4 py-3"
            >
              <p className="text-sm font-semibold capitalize">{plan}</p>
              <Button type="button" disabled>
                {tPortal("choosePlan")}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <Link
          href="/api-docs"
          className="text-sm font-medium text-primary hover:underline"
        >
          {tPortal("docsLink")}
        </Link>
      </div>
    </div>
  );
}

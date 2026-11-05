import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NavHeader({
  title,
  href,
  action,
  actionHref,
}: {
  title: string;
  href: string;
  action?: React.ReactNode;
  actionHref?: string;
}) {
  const tNav = await getTranslations("Nav");
  return (
    <>
      <Card className="rounded-none sm:hidden border-none fixed top-0 left-0 right-0 z-10">
        <CardHeader className="p-4 border-b border-border">
          <CardTitle className="relative">
            <Link href={href}>
              <Button
                className="absolute left-0 top-1/2 -translate-y-1/2"
                variant="ghost"
                size="sm"
              >
                <ChevronLeft className="size-5" />
                <span className="hidden sm:block">{tNav("back")}</span>
              </Button>
            </Link>
            <h1 className="text-lg font-bold text-center px-8 text-wrap line-clamp-1">
              {title}
            </h1>
            {action && (
              <Link href={actionHref || "#"}>
                <Button
                  className="absolute right-0 top-1/2 -translate-y-1/2"
                  variant="ghost"
                  size="sm"
                >
                  {action}
                </Button>
              </Link>
            )}
          </CardTitle>
        </CardHeader>
      </Card>
      <div className="mb-14 sm:hidden"></div>
    </>
  );
}

import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tDashboard = await getTranslations("Dashboard");
  return (
    <>
      <CardHeader className="px-0 gap-0 mb-2">
        <CardTitle className="text-xl">
          {tDashboard("layoutTitle")}
        </CardTitle>
        <CardDescription>
          {tDashboard("layoutDescription")}
        </CardDescription>
      </CardHeader>
      {children}
    </>
  );
}

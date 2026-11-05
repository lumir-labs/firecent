import {
  Card,
  CardContent,
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
  const tAdmin = await getTranslations("Admin");
  return (
    <>
      <CardHeader className="px-0 gap-0 mb-2">
        <CardTitle className="text-xl">
          {tAdmin("roles.layoutTitle")}
        </CardTitle>
        <CardDescription>
          {tAdmin("roles.layoutDescription")}
        </CardDescription>
      </CardHeader>
      <Card>
        <CardContent>{children}</CardContent>
      </Card>
    </>
  );
}

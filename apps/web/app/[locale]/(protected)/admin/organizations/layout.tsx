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
          {tAdmin("organizations.layoutTitle")}
        </CardTitle>
        <CardDescription>
          {tAdmin("organizations.layoutDescription")}
        </CardDescription>
      </CardHeader>
      <Card>
        <CardContent>{children}</CardContent>
      </Card>
    </>
  );
}

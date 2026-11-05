import { getTranslations } from "next-intl/server";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import ThemeSwitcher from "@/components/common/theme-switcher";
import { getServerSession } from "@/lib/auth";
import { db } from "@app/db";
import { ProfileForm } from "./_components/profile-form";
import { DeleteAccountCard } from "./_components/delete-account";
import { TwoFactorCard } from "./_components/two-factor-card";

export default async function Page() {
  const tPortal = await getTranslations("Portal");

  const session = await getServerSession();
  const record = session?.user?.id
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: {
          firstName: true,
          middleName: true,
          lastName: true,
          lastName2: true,
        },
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{tPortal("profileTitle")}</h1>
        <p className="text-muted-foreground text-sm">{tPortal("profileDesc")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="size-12">
              <AvatarImage src={session?.user.image || ""} />
              <AvatarFallback>
                {session?.user.name?.charAt(0).toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="truncate">{session?.user.name}</CardTitle>
              <CardDescription className="truncate">
                {session?.user.email}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ProfileForm
            firstName={record?.firstName ?? null}
            middleName={record?.middleName ?? null}
            lastName={record?.lastName ?? null}
            lastName2={record?.lastName2 ?? null}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-email">{tPortal("email")}</Label>
            <Input
              id="profile-email"
              value={session?.user.email ?? ""}
              readOnly
              disabled
            />
            <p className="text-xs text-muted-foreground">
              {tPortal("emailReadOnlyHint")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tPortal("preferences")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{tPortal("language")}</span>
            <LanguageSwitcher />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{tPortal("theme")}</span>
            <ThemeSwitcher variant="long" />
          </div>
        </CardContent>
      </Card>

      <TwoFactorCard enabled={Boolean(session?.user.twoFactorEnabled)} />

      <DeleteAccountCard />
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { Building2, KeyRound } from "lucide-react";

import AccessAlert from "@/components/common/access-alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { validatePermission } from "@/lib/actions/permissions";
import { getSessionOrganization } from "@/lib/actions/organization";
import { db } from "@app/db";
import { p } from "@app/api/permissions";
import { InvitationsCard } from "./_components/invitations-card";

/**
 * View of the organization in session.
 * Gate `organizations:menu` (the `p.*.menu` pattern used by admin pages):
 * without permission it shows AccessAlert. Members read-only + invitations
 * (create/cancel with `organization-members:*`, accept at
 * `/invitations/accept`) and a link to the API keys.
 */
export default async function Page() {
  const tPortal = await getTranslations("Portal");
  const tAdmin = await getTranslations("Admin");

  const menu = await validatePermission(p.organizations.read);
  if (!menu.hasPermission) {
    return (
      <AccessAlert
        title={tAdmin("accessDenied")}
        description={tAdmin("noPermission")}
      />
    );
  }

  const sessionOrg = await getSessionOrganization();
  if (!sessionOrg.OrganizationId) {
    return (
      <AccessAlert
        title={tPortal("orgTitle")}
        description={tPortal("orgNoOrg")}
      />
    );
  }

  const organization = await db.organization.findUnique({
    where: { id: sessionOrg.OrganizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      members: {
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { apiKeys: true } },
    },
  });

  if (!organization) {
    return (
      <AccessAlert
        title={tAdmin("errorTitle")}
        description={tPortal("orgLoadError")}
      />
    );
  }

  const [{ hasPermission: canInvite }, { hasPermission: canListMembers }] =
    await Promise.all([
      validatePermission(p.organizationMembers.create),
      validatePermission(p.organizationMembers.list),
    ]);

  const details: { label: string; value: string; mono?: boolean }[] = [
    { label: tPortal("orgName"), value: organization.name },
    { label: tPortal("orgSlug"), value: organization.slug ?? "—", mono: true },
    { label: tPortal("orgId"), value: organization.id, mono: true },
    {
      label: tPortal("orgDescription"),
      value: organization.description || tPortal("orgNoDescription"),
    },
    {
      label: tPortal("orgCreatedAt"),
      value: organization.createdAt
        ? new Date(organization.createdAt).toLocaleString()
        : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{tPortal("orgTitle")}</h1>
        <p className="text-muted-foreground text-sm">{tPortal("orgDesc")}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {organization.name}
          </CardTitle>
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="size-4" />
          </span>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-2 text-sm">
            {details.map(({ label, value, mono }) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-4"
              >
                <dt className="shrink-0 text-muted-foreground">{label}</dt>
                <dd
                  className={`min-w-0 truncate text-right font-medium ${mono ? "font-mono text-xs" : ""}`}
                  title={value}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            {tPortal("orgApiKeysTitle")}
            <Badge variant="secondary">{organization._count.apiKeys}</Badge>
          </CardTitle>
          <CardDescription>{tPortal("orgApiKeysDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/organization/api-keys"
            className={buttonVariants({ variant: "default" })}
          >
            {tPortal("orgManageKeys")}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {tPortal("orgMembers")}
            <Badge variant="secondary" className="ml-2">
              {organization.members.length}
            </Badge>
          </CardTitle>
          <CardDescription>{tPortal("orgMembersDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tPortal("orgColName")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {tPortal("orgColEmail")}
                </TableHead>
                <TableHead className="text-right">
                  {tPortal("orgColRole")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organization.members.map((member) => (
                <TableRow key={member.user.id}>
                  <TableCell className="font-medium">
                    {member.user.name || member.user.email}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {member.user.email}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{member.role}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canInvite || canListMembers ? (
        <InvitationsCard canInvite={canInvite} />
      ) : null}
    </div>
  );
}

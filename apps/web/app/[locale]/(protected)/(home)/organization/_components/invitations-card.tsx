"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, Loader2, MailPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  cancelInvitation,
  listInvitations,
  type OrgInvitation,
} from "@/lib/actions/invitations";
import { invitationStatusOf } from "@/lib/actions/invitation-helpers";
import { InviteForm } from "./invite-form";

export function InvitationsCard({ canInvite }: { canInvite: boolean }) {
  const tPortal = useTranslations("Portal");
  const [items, setItems] = useState<OrgInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await listInvitations();
    if (!result.error && result.data) setItems(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCancel(id: string) {
    setBusyId(id);
    try {
      const result = await cancelInvitation(id);
      if (result.error) {
        toast.error(result.error, { richColors: true });
        return;
      }
      toast.success(tPortal("invites.cancelledOk"), { richColors: true });
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailPlus className="size-4" />
          {tPortal("invites.title")}
          <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
        <CardDescription>{tPortal("invites.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canInvite ? <InviteForm onInvited={refresh} /> : null}
        {loading ? (
          <p className="text-sm text-muted-foreground">
            {tPortal("invites.empty")}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tPortal("invites.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tPortal("invites.colEmail")}</TableHead>
                  <TableHead>{tPortal("invites.colRole")}</TableHead>
                  <TableHead>{tPortal("invites.colStatus")}</TableHead>
                  {canInvite ? (
                    <TableHead className="text-right">
                      {tPortal("invites.colActions")}
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((inv) => {
                  const status = invitationStatusOf(inv);
                  const busy = busyId === inv.id;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{inv.role ?? "member"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status === "pending" ? "secondary" : "destructive"
                          }
                        >
                          {tPortal(`invites.${status}`)}
                        </Badge>
                      </TableCell>
                      {canInvite ? (
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || status !== "pending"}
                            onClick={() => handleCancel(inv.id)}
                            title={tPortal("invites.cancel")}
                          >
                            {busy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Ban className="size-3.5 text-destructive" />
                            )}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

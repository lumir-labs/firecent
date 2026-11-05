"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { authClient } from "@/lib/auth-client";
import { deleteMyAccount } from "@/lib/actions/account";

/**
 * Danger zone (DSR): really deletes the account (anonymizes + revokes
 * sessions/keys/memberships — see `account-core.ts`) and signs out.
 * The redirect to the landing happens on the client side after signOut.
 */
export function DeleteAccountCard() {
  const tPortal = useTranslations("Portal");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      const result = await deleteMyAccount();
      if (result.error) {
        toast.error(result.error, { richColors: true });
        return;
      }
      await authClient.signOut();
      // Locale-aware: never hardcode /es or /en here.
      window.location.href = `/${locale}/landing`;
    } catch {
      toast.error(tCommon("unknownError"), { richColors: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">
          {tPortal("danger.title")}
        </CardTitle>
        <CardDescription>{tPortal("danger.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger
            render={
              <Button variant="destructive">
                <Trash2 className="size-4" />
                {tPortal("danger.button")}
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {tPortal("danger.confirmTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {tPortal("danger.confirmDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>
                {tCommon("cancel")}
              </AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {tPortal("danger.confirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Eye, Loader2, Trash } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface BaseDataTableRowActionsProps {
  detailUrl: string;
  itemId: string | number;
  itemLabel: string;
  deleteFn?: (id: string | number) => Promise<{ error?: string }>;
}

export function BaseDataTableRowActions({
  detailUrl,
  itemId,
  itemLabel,
  deleteFn,
}: BaseDataTableRowActionsProps) {
  const t = useTranslations("Common");
  const { refresh } = useRouter();
  // itemLabel arrives already translated from the caller; generic fallback if missing.
  const item = itemLabel || t("rowDelete.fallbackItem");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await deleteFn?.(itemId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("rowDelete.deleted", { item }));
      setOpen(false);
      refresh();
    } catch {
      toast.error(t("rowDelete.error", { item }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {detailUrl && (
        <Link href={detailUrl}>
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-2"
          >
            <Eye className="size-3" />
          </Button>
        </Link>
      )}
      {deleteFn && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger
            render={
              <Button
                size="sm"
                variant={"outline"}
                className="flex items-center gap-2"
              >
                <Trash className="size-3 text-destructive" />
              </Button>
            }
          />
          <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rowDelete.title", { item })}</AlertDialogTitle>
          </AlertDialogHeader>
          <p>{t("rowDelete.confirm", { item })}</p>
          <AlertDialogFooter>
            <Button onClick={handleDelete} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("delete")}
            </Button>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

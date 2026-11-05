"use client";

import { useTranslations } from "next-intl";
import { deletePermission } from "@/lib/actions/permissions";
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
import { Input } from "@/components/ui/input";
import type { Row } from "@tanstack/react-table";
import { Loader2, Trash } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Permission } from "@app/db";
import AccessAlert from "@/components/common/access-alert";

interface DataTableRowActionsProps {
  row: Row<Permission>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const { refresh } = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<string>("");
  const confirmKeyword = tAdmin("permissions.delete.confirmKeyword", {
    name: row.original.name,
  });

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await deletePermission(row.original.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(tAdmin("permissions.delete.success"));
      setOpen(false);
      refresh();
    } catch {
      toast.error(tAdmin("permissions.delete.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
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
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {tAdmin("permissions.delete.title")}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <AccessAlert
          title={tAdmin("permissions.delete.danger")}
          description={tAdmin("permissions.delete.dangerDescription")}
        />
        <p>{tAdmin("permissions.delete.confirm")}</p>
        <div className="bg-accent text-card-foreground p-2 rounded-md">
          <p>{row.original.name}</p>
          <p>{row.original.label}</p>
        </div>
        <p className="text-card-foreground p-2 text-center text-sm">
          {tAdmin("permissions.delete.writePrefix")}{" "}
          <strong className="text-red-500 px-2">{confirmKeyword}</strong>{" "}
          {tAdmin("permissions.delete.writeSuffix")}
        </p>
        <Input
          type="text"
          placeholder={confirmKeyword}
          className="mt-2 bg-card"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <AlertDialogFooter>
          <Button
            onClick={handleDelete}
            disabled={loading || confirm !== confirmKeyword}
            variant="destructive"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {tCommon("delete")}
          </Button>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

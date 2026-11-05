"use client";

import { useTranslations } from "next-intl";
import { deleteRole } from "@/lib/actions/roles";
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
import type { Role } from "@/lib/actions/roles";
import type { Row } from "@tanstack/react-table";
import { Loader2, Trash } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface DataTableRowActionsProps {
  row: Row<Role>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const { refresh } = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await deleteRole(row.original.id);
      if (res.error) {
        toast.error(res.error, { richColors: true });
        return;
      }
      toast.success(tAdmin("roles.delete.success"), { richColors: true });
      setOpen(false);
      refresh();
    } catch {
      toast.error(tAdmin("roles.delete.error"), { richColors: true });
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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tAdmin("roles.delete.title")}</AlertDialogTitle>
        </AlertDialogHeader>
        <p>{tAdmin("roles.delete.confirm")}</p>
        <AlertDialogFooter>
          <Button onClick={handleDelete} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {tCommon("delete")}
          </Button>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { createRole } from "@/lib/actions/roles";

export default function NewRole() {
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormData>();
  const { refresh } = useRouter();
  const [open, setOpen] = useState(false);

  type FormData = {
    name: string;
    label: string;
  };

  async function onSubmit(data: FormData) {
    try {
      const response = await createRole({
        name: data.name,
        label: data.label,
      });
      if ("error" in response) {
        throw new Error(response.error);
      }
      toast.success(tAdmin("users.newRole.created"), { richColors: true });
      setOpen(false);
      refresh();
    } catch (error) {
      toast.error(
        (error as Error).message || tAdmin("users.newRole.createError"),
        {
          richColors: true,
        },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="flex items-center gap-2">
            <Plus className="size-3" /> {tAdmin("users.newRole.trigger")}
          </Button>
        }
      />
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>{tAdmin("users.newRole.title")}</DialogTitle>
          <DialogDescription>
            {tAdmin("users.newRole.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-2 mb-2">
            <Input
              placeholder={tAdmin("users.newRole.namePlaceholder")}
              {...register("name", { required: true })}
            />
            <Input
              placeholder={tAdmin("users.newRole.labelPlaceholder")}
              {...register("label", { required: true })}
            />
          </div>
          <DialogFooter>
            <div>
              {errors && (
                <p className="text-red-500 text-xs">
                  {Object.values(errors)
                    .map((error) => error.message)
                    .join(", ")}
                </p>
              )}
            </div>
            <DialogClose
              render={<Button variant="outline">{tCommon("cancel")}</Button>}
            />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

import BaseDialogSelect from "@/components/base/base-dialog-select";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import BaseDialogMultiSelect from "./base-dialog-multiselect";
import { DateTimePicker } from "../select/datetime-picker";
import { Checkbox } from "../ui/checkbox";
import { UseCatalogFnResult } from "@/lib/general-types";

export type BaseCreateFieldConfig = {
  name: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "multi-select"
    | "email"
    | "date"
    | "time"
    | "checkbox"
    | "datetime";
  placeholder?: string;
  required?: boolean;
  useOptionsFn?: () => UseCatalogFnResult;
};

type BaseCreateProps<TFormData extends Record<string, unknown>> = {
  fieldConfig: BaseCreateFieldConfig[];
  createFn: (
    data: TFormData,
  ) => Promise<{ error?: string } | Record<string, unknown>>;
  itemLabel?: string;
  triggerLabel?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  successMessage?: string;
  errorMessage?: string;
  triggerVariant?: "default" | "outline" | "ghost" | "secondary";
};

export default function BaseCreate<TFormData extends Record<string, unknown>>({
  fieldConfig,
  createFn,
  itemLabel,
  triggerLabel,
  dialogTitle,
  dialogDescription,
  successMessage,
  errorMessage,
  triggerVariant = "default",
}: BaseCreateProps<TFormData>) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refresh } = useRouter();

  // Texts: explicit props win, otherwise the dictionary's (itemLabel already comes translated).
  const triggerText = itemLabel
    ? t("baseCreate.createItem", { item: itemLabel })
    : (triggerLabel ?? t("baseCreate.trigger"));
  const titleText = itemLabel
    ? t("baseCreate.titleItem", { item: itemLabel })
    : (dialogTitle ?? t("baseCreate.title"));
  const descriptionText =
    dialogDescription ?? t("baseCreate.description");
  const successText = successMessage ?? t("baseCreate.success");
  const fallbackErrorText = errorMessage ?? t("baseCreate.error");

  // Generate default values dynamically
  const defaultValues = fieldConfig.reduce(
    (acc, field) => {
      acc[field.name] = "";
      return acc;
    },
    {} as Record<string, string>,
  );

  const form = useForm<Record<string, string>>({
    defaultValues,
  });

  async function onSubmit(data: Record<string, string>) {
    setIsSubmitting(true);
    try {
      const transformedData = { ...data };

      fieldConfig.forEach((field) => {
        if (field.type === "date" && transformedData[field.name]) {
          // Format: YYYY-MM-DD → YYYY-MM-DDT00:00:00.000Z (UTC, no timezone conversion)
          const [year, month, day] = transformedData[field.name].split("-");
          transformedData[field.name] = `${year}-${month}-${day}T00:00:00.000Z`;
        }
        if (field.type === "time" && transformedData[field.name]) {
          // Format: HH:MM → HH:MM:SS (UTC, no timezone conversion)
          const [hours, minutes] = transformedData[field.name].split(":");
          transformedData[field.name] = `1970-01-01T${hours}:${minutes}:00Z`;
        }
      });
      const response = await createFn(transformedData as TFormData);
      if (response?.error) {
        throw new Error(String(response.error));
      }
      toast.success(successText, { richColors: true });
      setOpen(false);
      form.reset();
      refresh();
    } catch (error) {
      toast.error((error as Error).message || fallbackErrorText, {
        richColors: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={triggerVariant} size="sm">
            <Plus className="size-4" />
            {triggerText}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            {fieldConfig.map((field) => (
              <Controller
                key={field.name}
                name={field.name}
                control={form.control}
                rules={{ required: field.required }}
                render={({ field: formField, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>
                      {field.label}
                      {field.required && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </FieldLabel>

                    {field.type === "text" || field.type === "email" ? (
                      <Input
                        type={field.type}
                        placeholder={field.placeholder || field.label}
                        value={formField.value as string}
                        onChange={formField.onChange}
                        onBlur={formField.onBlur}
                        name={formField.name}
                        ref={formField.ref}
                        disabled={isSubmitting}
                      />
                    ) : field.type === "number" ? (
                      <Input
                        type="number"
                        placeholder={field.placeholder || field.label}
                        value={formField.value}
                        onChange={(e) =>
                          formField.onChange(e.target.valueAsNumber)
                        }
                        onBlur={formField.onBlur}
                        name={formField.name}
                        ref={formField.ref}
                        disabled={isSubmitting}
                      />
                    ) : field.type === "textarea" ? (
                      <Textarea
                        placeholder={field.placeholder || field.label}
                        value={formField.value as string}
                        onChange={formField.onChange}
                        onBlur={formField.onBlur}
                        name={formField.name}
                        ref={formField.ref}
                        disabled={isSubmitting}
                      />
                    ) : field.type === "select" && field.useOptionsFn ? (
                      <BaseDialogSelect
                        value={formField.value}
                        onChangeAction={formField.onChange}
                        useCatalogFn={field.useOptionsFn}
                        itemLabel={field.label}
                      />
                    ) : field.type === "multi-select" && field.useOptionsFn ? (
                      <BaseDialogMultiSelect
                        onChangeAction={formField.onChange}
                        useCatalogFn={field.useOptionsFn}
                        itemLabel={field.label}
                      />
                    ) : field.type === "date" ? (
                      <Input
                        type="date"
                        placeholder={field.placeholder || field.label}
                        value={String(formField.value)}
                        onChange={formField.onChange}
                        onBlur={formField.onBlur}
                        name={formField.name}
                        ref={formField.ref}
                        disabled={isSubmitting}
                      />
                    ) : field.type === "time" ? (
                      <Input
                        type="time"
                        placeholder={field.placeholder || field.label}
                        value={formField.value as string}
                        onChange={formField.onChange}
                        onBlur={formField.onBlur}
                        name={formField.name}
                        ref={formField.ref}
                        disabled={isSubmitting}
                      />
                    ) : field.type === "checkbox" ? (
                      <Checkbox
                        checked={Boolean(formField.value)}
                        onCheckedChange={formField.onChange}
                        onBlur={formField.onBlur}
                        name={formField.name}
                        ref={formField.ref}
                        disabled={isSubmitting}
                      />
                    ) : field.type === "datetime" ? (
                      <DateTimePicker
                        date={
                          formField.value
                            ? new Date(formField.value)
                            : undefined
                        }
                        onDateUpdate={formField.onChange}
                        disabled={isSubmitting}
                      />
                    ) : null}

                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            ))}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                form.reset();
              }}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("creating")}
                </>
              ) : (
                <>{t("create")}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

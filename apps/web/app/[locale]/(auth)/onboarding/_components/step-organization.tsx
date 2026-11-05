"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { z } from "zod";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { ORGANIZATION_STEP_FORM_ID } from "./types";

export type OrganizationStepValues = {
  name: string;
  description?: string;
};

type StepOrganizationProps = {
  isSubmitting: boolean;
  onSubmitAction: (values: OrganizationStepValues) => void;
};

export function StepOrganization({
  isSubmitting,
  onSubmitAction,
}: StepOrganizationProps) {
  const t = useTranslations("Onboarding");

  const schema = z.object({
    name: z.string().min(3, t("organization.nameMin")).max(100, t("organization.nameMax")),
    description: z.string().max(500, t("organization.descriptionMax")).optional(),
  });

  const form = useForm<OrganizationStepValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  return (
    <div className="flex flex-col space-y-4 py-2">
      <div className="text-center space-y-2">
        <div className="bg-primary text-primary-foreground mx-auto flex size-12 items-center justify-center rounded-xl shadow-sm">
          <Building2 className="size-6" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">
          {t("organization.title")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("organization.description")}
        </p>
      </div>

      <form
        id={ORGANIZATION_STEP_FORM_ID}
        onSubmit={form.handleSubmit(onSubmitAction)}
        className="space-y-4 pt-2"
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">
              {t("organization.nameLabel")}
              <span className="text-destructive ml-1">*</span>
            </FieldLabel>
            <Input
              id="name"
              type="text"
              placeholder={t("organization.namePlaceholder")}
              disabled={isSubmitting}
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <FieldError errors={[form.formState.errors.name]} />
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="description">
              {t("organization.descriptionLabel")}
            </FieldLabel>
            <Textarea
              id="description"
              placeholder={t("organization.descriptionPlaceholder")}
              disabled={isSubmitting}
              rows={3}
              {...form.register("description")}
            />
            <FieldDescription>{t("organization.descriptionHint")}</FieldDescription>
            {form.formState.errors.description && (
              <FieldError errors={[form.formState.errors.description]} />
            )}
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}

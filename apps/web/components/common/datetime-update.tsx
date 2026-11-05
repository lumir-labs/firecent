"use client";

import { DateTimePicker } from "@/components/select/datetime-picker";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { getDateLocale } from "@/i18n/utils";

export default function DateTimeUpdate({
  defaultValue,
  updateFunction,
  id,
  canEdit,
}: {
  defaultValue?: Date | undefined;
  updateFunction: (id: number, data: Date) => Promise<{ error?: string }>;
  id: number;
  canEdit: boolean;
}) {
  const [date, setDate] = useState<Date | undefined>(defaultValue);
  const [currentDefaultValue, setCurrentDefaultValue] = useState<
    Date | undefined
  >(defaultValue);
  const t = useTranslations("Common");
  const dateLocale = getDateLocale(useLocale());

  async function updateDate(newDate: Date | undefined) {
    if (newDate && newDate !== currentDefaultValue) {
      setDate(newDate);
      try {
        const result = await updateFunction(id, newDate);
        if (result?.error) {
          toast.error(result.error);
          setDate(defaultValue);
          setCurrentDefaultValue(defaultValue);
        } else {
          toast.success(t("datetime.dateUpdated"));
          setCurrentDefaultValue(newDate);
        }
      } catch (error) {
        if (error instanceof Error) {
          toast.error(error.message);
          setDate(defaultValue);
        }
        console.error("Error updating date:", error);
      }
    }
  }

  return (
    <>
      {!canEdit ? (
        <div>
          {date?.toLocaleString(dateLocale, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "America/El_Salvador",
          })}
        </div>
      ) : (
        <DateTimePicker
          date={date}
          onDateUpdate={updateDate}
          disabled={!canEdit}
        />
      )}
    </>
  );
}

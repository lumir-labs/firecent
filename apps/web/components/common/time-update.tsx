"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { DatePicker } from "./date-picker";
import { getDateLocale } from "@/i18n/utils";

export default function DateUpdate({
  defaultValue,
  updateFunction,
  id,
  canEdit,
}: {
  defaultValue?: Date | undefined;
  updateFunction: (id: number, data: string) => Promise<{ error?: string }>;
  id: number;
  canEdit: boolean;
}) {
  const [date, setDate] = useState<Date | undefined>(defaultValue);
  const [currentDefaultValue, setCurrentDefaultValue] = useState<
    Date | undefined
  >(defaultValue);
  const t = useTranslations("Common");
  const dateLocale = getDateLocale(useLocale());

  async function updateDate() {
    if (date && date !== currentDefaultValue) {
      const dateString = `${date?.toISOString()?.split("T")[0]}T00:00:00.000Z`;
      try {
        const result = await updateFunction(id, dateString);
        if (result?.error) {
          toast.error(result.error);
          setDate(defaultValue);
          setCurrentDefaultValue(defaultValue);
        } else {
          toast.success(t("datetime.timeUpdated"));
          setCurrentDefaultValue(date);
        }
      } catch (error) {
        if (error instanceof Error) {
          toast.error(error.message);
          setDate(defaultValue);
          setCurrentDefaultValue(defaultValue);
        }
        console.error("Error updating date:", error);
      }
    }
  }

  return (
    <>
      {!canEdit ? (
        <div>
          {date?.toLocaleDateString(dateLocale, {
            dateStyle: "long",
            timeZone: "UTC",
          })}
        </div>
      ) : (
        <DatePicker
          date={date}
          setDate={setDate}
          onChange={updateDate}
          disabled={!canEdit}
        />
      )}
    </>
  );
}

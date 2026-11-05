"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { normalizeToLocalDate } from "@/lib/utils";
import { getDateLocale } from "@/i18n/utils";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

export function DatePicker({
  date,
  setDate,
  onChange,
  disabled,
}: {
  date?: Date | undefined;
  setDate?: (date: Date | undefined) => void;
  onChange?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Common");
  const dateLocale = getDateLocale(useLocale());

  // Normalized date for the Calendar (local time)
  const normalizedDate = normalizeToLocalDate(date);

  function handleDateChange(selectedDate: Date | undefined) {
    if (!selectedDate) {
      setDate?.(undefined);
      onChange?.();
      setOpen(false);
      return;
    }

    // On save, convert to UTC for the database
    const utcDate = new Date(
      Date.UTC(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        0,
        0,
        0,
        0,
      ),
    );

    setDate?.(utcDate);
    onChange?.();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            data-empty={!date}
            disabled={disabled}
            className="data-[empty=true]:text-muted-foreground w-[212px] justify-between text-left font-normal"
          >
            {date ? (
              // Display using UTC components so it matches the DB
              (() => {
                const d = new Date(date);
                return new Date(
                  d.getUTCFullYear(),
                  d.getUTCMonth(),
                  d.getUTCDate(),
                ).toLocaleDateString(dateLocale, { dateStyle: "long" });
              })()
            ) : (
              <span>{t("datetime.pickDate")}</span>
            )}
            <ChevronDownIcon />
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          disabled={disabled}
          selected={normalizedDate}
          onSelect={handleDateChange}
          defaultMonth={normalizedDate}
        />
      </PopoverContent>
    </Popover>
  );
}

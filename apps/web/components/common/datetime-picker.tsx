"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getDateLocale } from "@/i18n/utils";
import { ChevronDownIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function DateTimePicker({
  date,
  onDateUpdate,
  disabled,
}: {
  date?: Date | undefined;
  onDateUpdate?: (date: Date | undefined) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState<Date | undefined>(
    date,
  );
  const t = useTranslations("Common");
  const dateLocale = getDateLocale(useLocale());

  // Sync when the date prop changes from outside
  useEffect(() => {
    setSelectedDateTime(date);
  }, [date]);

  // Format the time for an input type="time" (HH:MM)
  const timeValue = selectedDateTime
    ? selectedDateTime.toLocaleTimeString(dateLocale, {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/El_Salvador",
      })
    : "00:00";

  function handleClose(willOpen: boolean) {
    if (!willOpen) {
      // Only save if a date is selected
      handleSave();
    }
    setOpen(willOpen);
  }

  function handleDateSelect(newDate: Date | undefined) {
    if (!newDate) {
      setSelectedDateTime(undefined);
      return;
    }

    // Keep the current time if it exists, or use 00:00
    const currentTime = selectedDateTime || new Date();
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();

    // Create a NEW Date object (don't mutate)
    const combined = new Date(newDate);
    combined.setHours(hours, minutes, 0, 0);

    setSelectedDateTime(combined);
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const [hours, minutes] = e.target.value.split(":").map(Number);

    // Use the current date or create a new one if it doesn't exist
    const baseDate = selectedDateTime || new Date();

    // Create a NEW Date object (don't mutate)
    const newDateTime = new Date(baseDate);
    newDateTime.setHours(hours, minutes, 0, 0);

    setSelectedDateTime(newDateTime);
  }

  // Save explicitly with a button (better UX)
  function handleSave() {
    if (selectedDateTime && selectedDateTime !== date) {
      onDateUpdate?.(selectedDateTime);
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleClose}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            data-empty={!date}
            disabled={disabled}
            className="data-[empty=true]:text-muted-foreground w-[212px] justify-between text-left font-normal"
          >
            {date ? (
              date.toLocaleString(dateLocale, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "America/El_Salvador",
              })
            ) : (
              <span>{t("datetime.selectDate")}</span>
            )}
            <ChevronDownIcon />
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          disabled={disabled}
          selected={selectedDateTime}
          onSelect={handleDateSelect}
          defaultMonth={date}
        />

        <div className="p-4 border-t flex items-center justify-between gap-4">
          <Label htmlFor="time" className="text-sm font-medium">
            {t("datetime.time")}
          </Label>
          <Input
            id="time"
            type="time"
            value={timeValue}
            onChange={handleTimeChange}
            disabled={!selectedDateTime}
          />
        </div>

        {/* Optional but recommended confirmation button */}
        <div className="p-4 pt-0">
          <Button
            onClick={handleSave}
            disabled={!selectedDateTime}
            className="w-full"
            size="sm"
          >
            {t("datetime.accept")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

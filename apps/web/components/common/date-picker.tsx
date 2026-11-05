"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { normalizeToLocalDate } from "@/lib/utils";
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
  onChange?: (date: Date | undefined) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(true);

  // Normalized date for the Calendar (local time)
  const normalizedDate = normalizeToLocalDate(date);

  function handleDateChange(selectedDate: Date | undefined) {
    if (!selectedDate) {
      setDate?.(undefined);
      onChange?.(undefined);
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
    onChange?.(utcDate);
    setOpen(false);
  }

  return (
    <Calendar
      mode="single"
      disabled={disabled}
      selected={normalizedDate}
      onSelect={handleDateChange}
      defaultMonth={normalizedDate}
    />
  );
}

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "../ui/combobox";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeOption {
  label: string;
  minutes: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseInput(input: string): number | null {
  const t = input.trim();
  if (!t) return null;

  // "1h 30min" / "1h30m" / "1h 30"
  const hm = t.match(/^(\d+(?:\.\d+)?)\s*h\s*(\d+)\s*(?:m(?:in)?)?$/i);
  if (hm) return Math.round(parseFloat(hm[1]) * 60 + parseInt(hm[2]));

  // "1.5h" / "2h"
  const h = t.match(/^(\d+(?:\.\d+)?)\s*h$/i);
  if (h) return Math.round(parseFloat(h[1]) * 60);

  // "30m" / "30min"
  const m = t.match(/^(\d+(?:\.\d+)?)\s*m(?:in)?$/i);
  if (m) return Math.round(parseFloat(m[1]));

  // Plain number → minutes
  const plain = t.match(/^(\d+(?:\.\d+)?)$/);
  if (plain) return Math.round(parseFloat(plain[1]));

  return null;
}

export function formatMinutes(minutes: unknown): string {
  if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes <= 0)
    return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

const DEFAULT_PRESETS: TimeOption[] = [60, 120, 240].map((m) => ({
  minutes: m,
  label: formatMinutes(m),
}));

// 1. For numbers < 10, hours comes first
function generateSuggestions(input: string): TimeOption[] {
  if (!input.trim()) return DEFAULT_PRESETS;

  const isPlainInteger = /^\d+$/.test(input.trim());
  const isPlainDecimal = /^\d+\.\d+$/.test(input.trim());

  // "1.5" → interpret directly as hours → 90 min → "1h 30min"
  if (isPlainDecimal) {
    const minutes = Math.round(parseFloat(input.trim()) * 60);
    if (minutes <= 0) return [];
    return [{ minutes, label: formatMinutes(minutes) }];
  }

  const parsed = parseInput(input);
  if (parsed === null || parsed <= 0) return [];

  if (isPlainInteger) {
    const asMinutes: TimeOption = {
      minutes: parsed,
      label: formatMinutes(parsed),
    };
    const asHours: TimeOption = {
      minutes: parsed * 60,
      label: formatMinutes(parsed * 60),
    };
    return parsed <= 10 ? [asHours, asMinutes] : [asMinutes, asHours];
  }

  return [{ minutes: parsed, label: formatMinutes(parsed) }];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MinutesPicker({
  disabled,
  value,
  onChange,
}: {
  disabled?: boolean;
  value?: number | null;
  onChange?: (value: number | null) => void;
}) {
  const [inputValue, setInputValue] = useState(
    value !== undefined ? formatMinutes(value) : "",
  );
  const t = useTranslations("Common");

  const suggestions = useMemo(
    () => generateSuggestions(inputValue),
    [inputValue],
  );

  return (
    <Combobox
      items={suggestions}
      itemToStringValue={(item: TimeOption) => item.label}
      filter={() => true}
      onValueChange={(item: TimeOption | null) => {
        if (!item) return;
        setInputValue(item.label);
        onChange?.(item.minutes);
      }}
      disabled={disabled}
    >
      <ComboboxInput
        placeholder={t("datetime.minutesPlaceholder")}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;

          if (!inputValue.trim()) {
            onChange?.(null);
            return;
          }

          if (suggestions.length > 0) {
            const first = suggestions[0];
            setInputValue(first.label);
            onChange?.(first.minutes);
          }
        }}
      />
      <ComboboxContent>
        <ComboboxEmpty>{t("datetime.badFormat")}</ComboboxEmpty>
        <ComboboxList>
          {(item: TimeOption) => (
            <ComboboxItem key={item.minutes} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

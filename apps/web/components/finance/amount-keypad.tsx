"use client";

import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

export type AmountKeypadProps = {
  value: string;
  onChange: (next: string) => void;
  backspaceLabel?: string;
  className?: string;
};

/**
 * Firecent N9 touch keypad for entering currency amounts on mobile (< lg).
 * Caps at 2 decimal places and 9 integer digits.
 */
export function AmountKeypad({
  value,
  onChange,
  backspaceLabel = "Backspace",
  className,
}: AmountKeypadProps) {
  function press(key: (typeof KEYS)[number]) {
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === ".") {
      if (value.includes(".")) return;
      onChange(value === "" ? "0." : `${value}.`);
      return;
    }
    const [intPart = "", decPart] = value.split(".");
    if (decPart !== undefined) {
      if (decPart.length >= 2) return;
      onChange(`${value}${key}`);
      return;
    }
    if (intPart.length >= 9) return;
    if (value === "0") {
      onChange(key);
      return;
    }
    onChange(`${value}${key}`);
  }

  return (
    <div
      className={cn("grid grid-cols-3 gap-1.5 select-none", className)}
      role="group"
    >
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={key === "back" ? backspaceLabel : key}
          onClick={() => press(key)}
          className="num flex h-12 items-center justify-center rounded-xl bg-muted/60 text-[20px] font-medium text-foreground transition-colors active:bg-accent"
        >
          {key === "back" ? <Delete className="size-5" aria-hidden /> : key}
        </button>
      ))}
    </div>
  );
}

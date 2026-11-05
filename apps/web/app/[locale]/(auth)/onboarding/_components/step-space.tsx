"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { UsageOption } from "./types";
import { VaultIllustration } from "./onboarding-illustrations";

type StepSpaceProps = {
  usage: UsageOption;
  spaceName: string;
  error: string | null;
  onSpaceNameChange: (value: string) => void;
  isSubmitting: boolean;
};

export function StepSpace({
  usage,
  spaceName,
  error,
  onSpaceNameChange,
  isSubmitting,
}: StepSpaceProps) {
  const t = useTranslations("Onboarding.space");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Name ideas that match how the person said they'll use Firecent
  const allSuggestions = t.raw("suggestions") as Record<string, string[]>;
  const suggestions =
    allSuggestions[usage === "team" ? "business" : usage] ?? allSuggestions.group ?? [];

  React.useEffect(() => {
    // Auto-focus input once the slide-in transition has settled
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  const helpId = error ? "spaceName-error" : "spaceName-hint";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col space-y-6">
      <div className="flex flex-col items-center space-y-4 text-center">
        <VaultIllustration className="size-20 sm:size-24" />
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-balance text-foreground sm:text-[28px]">
            {t("title")}
          </h1>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="spaceName" className="sr-only">
          {t("inputLabel")}
        </label>
        <InputGroup
          className={cn(
            "h-12 rounded-2xl bg-card shadow-xs transition-all",
            error
              ? "border-destructive focus-within:border-destructive focus-within:ring-2 focus-within:ring-destructive/20"
              : "border-border/80 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
          )}
        >
          <InputGroupAddon className="pl-3.5 text-muted-foreground/70">
            <Users className="size-4.5" />
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            id="spaceName"
            name="spaceName"
            type="text"
            autoComplete="off"
            enterKeyHint="go"
            maxLength={100}
            disabled={isSubmitting}
            value={spaceName}
            onChange={(e) => onSpaceNameChange(e.target.value)}
            placeholder={t("inputPlaceholder")}
            aria-invalid={!!error}
            aria-describedby={helpId}
            className="text-base font-medium placeholder:text-muted-foreground/50"
          />
        </InputGroup>

        <p
          id={helpId}
          role={error ? "alert" : undefined}
          className={cn(
            "px-1 text-xs",
            error ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {error ?? t("hint")}
        </p>
      </div>

      {suggestions.length > 0 && (
        <div
          role="group"
          aria-label={t("suggestionsLabel")}
          className="flex flex-wrap justify-center gap-2"
        >
          {suggestions.map((suggestion) => {
            const isActive = spaceName.trim() === suggestion;
            return (
              <button
                key={suggestion}
                type="button"
                aria-pressed={isActive}
                disabled={isSubmitting}
                onClick={() => {
                  onSpaceNameChange(suggestion);
                  inputRef.current?.focus();
                }}
                className={cn(
                  "h-8 cursor-pointer rounded-full border px-3.5 text-sm font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:opacity-50",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {suggestion}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

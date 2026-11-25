"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { BlazeIcon } from "./blaze-icon";

export type AssistantAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  /** "outline" = E15 on sand (default for the first action), "text" = E16 in accent. */
  variant?: "outline" | "text";
};

export type AssistantCardProps = {
  /** "Your assistant noticed". */
  eyebrow: string;
  title: string;
  body: ReactNode;
  actions?: AssistantAction[];
  /**
   * Shows the close button. Without `onDismiss` the card hides itself
   * (local state); with it, the parent decides (persist the dismissal).
   */
  dismissible?: boolean;
  onDismiss?: () => void;
  /** Accessible name of the close button. Default "Dismiss". */
  dismissLabel?: string;
  /** Heading id for `aria-labelledby`. */
  id?: string;
  className?: string;
};

/** E13 — the assistant's insight on a sand surface, with the color flame. */
export function AssistantCard({
  eyebrow,
  title,
  body,
  actions = [],
  dismissible = true,
  onDismiss,
  dismissLabel,
  id,
  className,
}: AssistantCardProps) {
  const t = useTranslations("Finance.assistant");
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-assistant-border bg-assistant p-4",
        className,
      )}
    >
      {dismissible && (
        <button
          type="button"
          onClick={() => (onDismiss ? onDismiss() : setHidden(true))}
          aria-label={dismissLabel ?? t("dismiss")}
          className="absolute top-1 right-1 grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X aria-hidden className="size-[18px]" />
        </button>
      )}
      <p
        className={cn(
          "flex items-center gap-2 text-[13px] font-medium text-assistant-accent",
          dismissible && "pr-10",
        )}
      >
        <BlazeIcon className="size-5" />
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-2.5 text-[17px] leading-[23px] font-semibold tracking-[-0.01em]"
      >
        {title}
      </h2>
      <div className="mt-1.5 text-[14px] leading-[21px] text-foreground/80">{body}</div>
      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {actions.map((a, i) => {
            const variant = a.variant ?? (i === 0 ? "outline" : "text");
            const v = variant === "outline" ? "outline" : "text";
            const extra =
              v === "outline"
                ? "ring-assistant-border hover:bg-accent/60 dark:bg-card dark:ring-assistant-border"
                : "text-assistant-accent hover:bg-foreground/5";
            return a.href ? (
              <Link
                key={a.label}
                href={a.href}
                className={cn(buttonVariants({ variant: v, size: "touch" }), extra)}
                onClick={a.onClick}
              >
                {a.label}
              </Link>
            ) : (
              <Button
                key={a.label}
                variant={v}
                size="touch"
                className={extra}
                onClick={a.onClick}
              >
                {a.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AssistantCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-assistant-border bg-assistant p-4",
        className,
      )}
    >
      <Skeleton className="h-4 w-40 bg-assistant-border/60" />
      <Skeleton className="h-5 w-3/4 bg-assistant-border/60" />
      <Skeleton className="h-12 w-full bg-assistant-border/60" />
    </div>
  );
}

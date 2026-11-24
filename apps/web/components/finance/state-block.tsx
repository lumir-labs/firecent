import { CloudOff, type LucideIcon, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { isValidElement, type ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type StateKind = "empty" | "error" | "no-results";

export type StateAction = {
  /** Defaults per kind: error "Try again", no-results "Clear filters". Required for empty. */
  label?: string;
  href?: string;
  /** Client parents only. */
  onClick?: () => void;
};

export type StateBlockProps = {
  kind: StateKind;
  /** Defaults: error `cloud-off`, no-results `search`. Required for empty. */
  icon?: LucideIcon;
  /** Defaults from SPEC §4.1 for error and no-results. */
  title?: string;
  body?: ReactNode;
  /** A ready-made node, or `{ label, href | onClick }` styled per kind (empty: primary E14, error: outline E15, no-results: text E16). */
  action?: ReactNode | StateAction;
  /** Extra actions under the main one (ReactNode). */
  secondaryAction?: ReactNode;
  className?: string;
};

const VARIANT = {
  empty: "default",
  error: "outline",
  "no-results": "text",
} as const;

/**
 * N13 — empty, error and no-results block, on `Empty variant="state"`.
 * Errors replace the content only; the navigation stays (SPEC §4.1).
 */
export function StateBlock({
  kind,
  icon,
  title,
  body,
  action,
  secondaryAction,
  className,
}: StateBlockProps) {
  const t = useTranslations("Finance.state");
  const Icon = icon ?? (kind === "error" ? CloudOff : Search);
  const defaults =
    kind === "error"
      ? { title: t("errorTitle"), body: t("errorBody"), action: t("errorAction") }
      : kind === "no-results"
        ? { title: t("noResultsTitle"), body: t("noResultsBody"), action: t("noResultsAction") }
        : { title: undefined, body: undefined, action: undefined };

  let actionNode: ReactNode = null;
  if (action != null && (isValidElement(action) || typeof action !== "object")) {
    actionNode = action as ReactNode;
  } else if (action != null) {
    const a = action as StateAction;
    const label = a.label ?? defaults.action;
    const variant = VARIANT[kind];
    if (label) {
      actionNode = a.href ? (
        <Link href={a.href} className={buttonVariants({ variant, size: "touch" })}>
          {label}
        </Link>
      ) : (
        <Button variant={variant} size="touch" onClick={a.onClick}>
          {label}
        </Button>
      );
    }
  }

  const finalTitle = title ?? defaults.title;
  const finalBody = body ?? defaults.body;

  return (
    <Empty
      variant="state"
      role={kind === "error" ? "alert" : undefined}
      // Empty is `border-dashed`; inside a `divide-y` card the dividers must stay solid.
      className={cn("border-solid", className)}
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden />
        </EmptyMedia>
        {finalTitle && <EmptyTitle>{finalTitle}</EmptyTitle>}
        {finalBody && <EmptyDescription>{finalBody}</EmptyDescription>}
      </EmptyHeader>
      {(actionNode || secondaryAction) && (
        <EmptyContent>
          {actionNode}
          {secondaryAction}
        </EmptyContent>
      )}
    </Empty>
  );
}

/**
 * E18 — loading container: `aria-busy` + one sr-only status line. Put the
 * `*Skeleton` components inside; they are hidden from assistive tech.
 */
export function LoadingRegion({
  label,
  children,
  className,
}: {
  /** Default "Loading…". */
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations("Finance.state");
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        {label ?? t("loading")}
      </p>
      <div aria-hidden="true" className={className}>
        {children}
      </div>
    </div>
  );
}

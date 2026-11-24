"use client";

import { useTheme } from "next-themes";
import {
  toast,
  Toaster as Sonner,
  type ExternalToast,
  type ToasterProps,
} from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Alert02Icon,
  MultiplicationSignCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";

/**
 * Firecent N12 toast: dark pill on light (and the inverse in dark mode), 6 s.
 * Opt-in per toast so the ~80 existing `toast.success/error` calls keep their
 * richColors look. Colors travel as CSS variables on the toast element (sonner
 * reads --normal-*), so no !important is needed. Position is a Toaster-level
 * prop in sonner: for bottom placement mount
 * `<Toaster position="bottom-center" mobileOffset={{ bottom: 96 }} />`.
 */
const FIRECENT_TOAST_DURATION = 6000;

const firecentToastOptions: ExternalToast = {
  duration: FIRECENT_TOAST_DURATION,
  className: "font-medium text-[14px]",
  style: {
    "--normal-bg": "var(--foreground)",
    "--normal-text": "var(--background)",
    "--normal-border": "transparent",
    "--border-radius": "var(--radius-2xl)",
  } as React.CSSProperties,
  classNames: {
    actionButton: "bg-transparent! font-semibold text-background!",
  },
};

function firecentToast(message: React.ReactNode, data?: ExternalToast) {
  return toast(message, {
    ...firecentToastOptions,
    ...data,
    style: { ...firecentToastOptions.style, ...data?.style },
    classNames: { ...firecentToastOptions.classNames, ...data?.classNames },
  });
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        info: (
          <HugeiconsIcon
            icon={InformationCircleIcon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        warning: (
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        error: (
          <HugeiconsIcon
            icon={MultiplicationSignCircleIcon}
            strokeWidth={2}
            className="size-4"
          />
        ),
        loading: (
          <HugeiconsIcon
            icon={Loading03Icon}
            strokeWidth={2}
            className="size-4 animate-spin"
          />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, firecentToast, firecentToastOptions };

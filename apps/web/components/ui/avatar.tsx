"use client";

import * as React from "react";
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

import { cn } from "@/lib/utils";

/** Same keys as the Prisma `Colors` enum. */
type AvatarColor =
  | "DEFAULT"
  | "GRAY"
  | "BROWN"
  | "ORANGE"
  | "YELLOW"
  | "GREEN"
  | "BLUE"
  | "PURPLE"
  | "PINK"
  | "RED";

// Literal class names so Tailwind can see them (N26).
const avatarColorClasses: Record<AvatarColor, string> = {
  DEFAULT:
    "group-data-[color=DEFAULT]/avatar:bg-brand-default group-data-[color=DEFAULT]/avatar:text-brand-default-foreground",
  GRAY: "group-data-[color=GRAY]/avatar:bg-brand-gray group-data-[color=GRAY]/avatar:text-brand-gray-foreground",
  BROWN:
    "group-data-[color=BROWN]/avatar:bg-brand-brown group-data-[color=BROWN]/avatar:text-brand-brown-foreground",
  ORANGE:
    "group-data-[color=ORANGE]/avatar:bg-brand-orange group-data-[color=ORANGE]/avatar:text-brand-orange-foreground",
  YELLOW:
    "group-data-[color=YELLOW]/avatar:bg-brand-yellow group-data-[color=YELLOW]/avatar:text-brand-yellow-foreground",
  GREEN:
    "group-data-[color=GREEN]/avatar:bg-brand-green group-data-[color=GREEN]/avatar:text-brand-green-foreground",
  BLUE: "group-data-[color=BLUE]/avatar:bg-brand-blue group-data-[color=BLUE]/avatar:text-brand-blue-foreground",
  PURPLE:
    "group-data-[color=PURPLE]/avatar:bg-brand-purple group-data-[color=PURPLE]/avatar:text-brand-purple-foreground",
  PINK: "group-data-[color=PINK]/avatar:bg-brand-pink group-data-[color=PINK]/avatar:text-brand-pink-foreground",
  RED: "group-data-[color=RED]/avatar:bg-brand-red group-data-[color=RED]/avatar:text-brand-red-foreground",
};
const allAvatarColorClasses = Object.values(avatarColorClasses).join(" ");

function Avatar({
  className,
  size = "default",
  color,
  ...props
}: AvatarPrimitive.Root.Props & {
  /** sm 24, default 32, lg 40; Firecent: xs 16, md 28 (and lg 40). */
  size?: "xs" | "sm" | "md" | "default" | "lg";
  /** Firecent N26: tints the fallback with `bg-brand-{c} text-brand-{c}-foreground`. */
  color?: AvatarColor;
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      data-color={color}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=md]:size-7 data-[size=sm]:size-6 data-[size=xs]:size-4 dark:after:mix-blend-lighten",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className,
      )}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs group-data-[size=md]/avatar:text-[12px] group-data-[size=xs]/avatar:text-[9px] group-data-[color]/avatar:font-semibold",
        allAvatarColorClasses,
        className,
      )}
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=xs]/avatar:size-1.5 group-data-[size=xs]/avatar:[&>svg]:hidden group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden group-data-[size=md]/avatar:size-2 group-data-[size=md]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
};

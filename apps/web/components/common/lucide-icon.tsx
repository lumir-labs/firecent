"use client";

import React from "react";
import { useTranslations } from "next-intl";
// Import all Lucide icons
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

interface LucideIconProps {
  iconName: string | null | undefined;
  className?: string;
  strokeWidth?: number;
}

export const LucideIcon: React.FC<LucideIconProps> = ({
  iconName,
  className,
  strokeWidth,
}) => {
  const t = useTranslations("Common");
  if (!iconName)
    return <LucideIcons.ImageOff className={cn("size-4", className)} />;
  // Look up the icon dynamically
  const IconComponent = LucideIcons[
    iconName as keyof typeof LucideIcons
  ] as React.ElementType;

  // If the icon is not found, render a fallback (e.g., a default icon or message)
  if (!IconComponent) {
    return <p>{t("iconNotFound", { name: iconName })}</p>;
  }

  // Render the icon with the provided className
  return (
    <IconComponent
      {...(className && { className })}
      {...(strokeWidth && { strokeWidth })}
    />
  );
};

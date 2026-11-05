/* eslint-disable import/namespace */
import * as React from "react";
import * as LucideIcons from "lucide-react-native";
import { Icon } from "./icon";

type LucideIconsModule = typeof LucideIcons;

// Only names of exports that are real icons
type LucideIconName = {
  [K in keyof LucideIconsModule]: LucideIconsModule[K] extends LucideIcons.LucideIcon
    ? K
    : never;
}[keyof LucideIconsModule];

type LucideIconProps = {
  iconName: LucideIconName;
  color?: string;
  size?: number;
  strokeWidth?: number;
};

function LucideIcon({
  iconName,
  color,
  size = 20,
  strokeWidth,
}: LucideIconProps) {
  // No explicit annotation needed: TS infers LucideIcon
  const icon = LucideIcons[iconName];

  return (
    <Icon icon={icon} color={color} size={size} strokeWidth={strokeWidth} />
  );
}

export { LucideIcon };
export type { LucideIconName, LucideIconProps };

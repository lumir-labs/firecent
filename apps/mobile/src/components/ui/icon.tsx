import * as React from "react";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "expo-router";

const IconClassContext = React.createContext<string | undefined>(undefined);
// Default size for child icons (e.g. Button sets it from its `size`).
// Priority in `Icon`: explicit `size` > context > 20.
const IconSizeContext = React.createContext<number | undefined>(undefined);

type IconProps = {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function Icon({
  icon: IconComponent,
  size,
  color,
  strokeWidth,
}: IconProps) {
  const { colors } = useTheme();
  const contextColor = React.useContext(IconClassContext);
  const contextSize = React.useContext(IconSizeContext);

  return (
    <IconComponent
      size={size ?? contextSize ?? 20}
      // Priority: explicit color > Button context > navigation text
      // (theme-aware via expo-router, follows the manual theme). Without the
      // context, Button cannot tint its icons: they fell back to
      // `colors.text` and looked inverted relative to the button's text.
      color={color ?? contextColor ?? String(colors.text)}
      strokeWidth={strokeWidth}
    />
  );
}

export { Icon, IconClassContext, IconSizeContext };
export type { IconProps };

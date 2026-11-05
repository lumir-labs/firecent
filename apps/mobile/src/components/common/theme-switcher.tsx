import { Icon } from "../ui/icon";
import { Sun, Moon } from "lucide-react-native";
import { Button } from "../ui/button";
import { useThemePreference } from "@/lib/theme-provider";

export default function ThemeSwitcher({
  size = "icon",
}: {
  size?: "icon" | "icon-sm";
}) {
  const { theme, setTheme } = useThemePreference();

  return (
    <Button
      variant="secondary"
      size={size}
      onPress={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Icon icon={theme === "dark" ? Moon : Sun} />
    </Button>
  );
}

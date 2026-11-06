import { View, Text } from "react-native";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Search as SearchIcon } from "lucide-react-native";
import { useThemeColors } from "@/lib/theme-colors";
import { useI18n } from "@/lib/i18n-provider";

export default function SearchScreen() {
  const { t } = useI18n();
  const palette = useThemeColors();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6 gap-3">
        <View className="h-16 w-16 rounded-full items-center justify-center bg-muted">
          <SearchIcon size={32} color={palette.foreground} />
        </View>
        <Text className="text-xl font-inter-bold text-foreground">{t("Search.title")}</Text>
        <Text className="text-sm text-center text-muted-foreground">
          {t("Search.description")}
        </Text>
      </View>
    </SafeAreaView>
  );
}

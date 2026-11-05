import { View, Text } from "react-native";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { Heart as HeartIcon } from "lucide-react-native";
import { useThemePreference } from "@/lib/theme-provider";
import { useI18n } from "@/lib/i18n-provider";
import { semanticTokens } from "@app/lib/tokens/semantic";

export default function FavoritesScreen() {
  const { resolved } = useThemePreference();
  const { t } = useI18n();
  const palette = semanticTokens[resolved];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6 gap-3">
        <View className="h-16 w-16 rounded-full items-center justify-center bg-muted">
          <HeartIcon size={32} color={palette.foreground} />
        </View>
        <Text className="text-xl font-inter-bold text-foreground">{t("Favorites.title")}</Text>
        <Text className="text-sm text-center text-muted-foreground">
          {t("Favorites.description")}
        </Text>
      </View>
    </SafeAreaView>
  );
}

import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { type ContentType, type ThemeMode } from "../shared/everyyou/domain";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";

type HomeScreenProps = {
  themeMode: ThemeMode;
  hasCustomName: boolean;
  nameDraft: string;
  namePlaceholder: string;
  onAddPress: () => void;
  onOpenLibraryType: (type: ContentType) => void;
  onOpenVibeCheck: () => void;
  onNameDraftChange: (value: string) => void;
  onSaveNamePress: () => void;
};

export function HomeScreen({
  themeMode,
  hasCustomName,
  nameDraft,
  namePlaceholder,
  onAddPress,
  onOpenLibraryType,
  onOpenVibeCheck,
  onNameDraftChange,
  onSaveNamePress,
}: HomeScreenProps) {
  const theme = getTheme(themeMode);
  const [editingName, setEditingName] = useState(!hasCustomName);

  useEffect(() => {
    if (!hasCustomName) {
      setEditingName(true);
      return;
    }
    setEditingName(false);
  }, [hasCustomName]);

  return (
    <View style={appStyles.screen}>
      {!hasCustomName || editingName ? (
        <View style={[appStyles.card, themeMode === "dark" ? { backgroundColor: theme.accentYellow, borderColor: theme.border } : appStyles.cardAccentYellow]}>
          <Text style={[appStyles.label, { color: themeMode === "dark" ? theme.mutedText : undefined }]}>как тебя зовут?</Text>
          <TextInput
            style={[
              appStyles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.inputText,
              },
            ]}
            placeholder={namePlaceholder}
            placeholderTextColor={theme.inputPlaceholder}
            value={nameDraft}
            onChangeText={onNameDraftChange}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <PillButton
            label={hasCustomName ? "обновить имя" : "сохранить имя"}
            variant="primary"
            themeMode={themeMode}
            disabled={!nameDraft.trim()}
            onPress={() => {
              onSaveNamePress();
              setEditingName(false);
            }}
          />
        </View>
      ) : null}

      <View
        style={[
          appStyles.sectionHero,
          appStyles.sectionHeroAlt,
          themeMode === "dark" && { backgroundColor: theme.accentBlue, borderColor: theme.border },
        ]}
      >
        <Text style={appStyles.sectionTitle}>что это</Text>
        <Text style={appStyles.helper}>
          здесь живут музыка, книги и фильмы, которые ты реально слушала, читала и смотрела. не список на потом, а след того,
          что с тобой происходило.
        </Text>
        <Text style={appStyles.metaText}>
          потом из этого получается библиотека, таймлайн вкуса и нормальный вайбчек, а не просто склад названий.
        </Text>
        <PillButton label="добавить контент" variant="primary" themeMode={themeMode} onPress={onAddPress} />
      </View>

      <View style={appStyles.tileGrid}>
        <Pressable style={[appStyles.tile, appStyles.homeFeatureTile, appStyles.tilePink]} onPress={() => onOpenLibraryType("music")}>
          <Text style={appStyles.metaDate}>музыка</Text>
          <Text style={appStyles.itemTitle}>трек за треком</Text>
          <Text style={appStyles.metaText}>spotify, last.fm, скриншоты и ручной импорт.</Text>
        </Pressable>

        <Pressable style={[appStyles.tile, appStyles.homeFeatureTile, appStyles.tileGreen]} onPress={() => onOpenLibraryType("book")}>
          <Text style={appStyles.metaDate}>книги</Text>
          <Text style={appStyles.itemTitle}>книжная полка</Text>
          <Text style={appStyles.metaText}>livelib и другие экспортные файлы можно загрузить прямо здесь.</Text>
        </Pressable>

        <Pressable style={[appStyles.tile, appStyles.homeFeatureTile, appStyles.tileBlue]} onPress={() => onOpenLibraryType("film")}>
          <Text style={appStyles.metaDate}>фильмы</Text>
          <Text style={appStyles.itemTitle}>все просмотры</Text>
          <Text style={appStyles.metaText}>letterboxd, кинопоиск, mubi и любые странные списки через импорт изображений.</Text>
        </Pressable>

        <Pressable style={[appStyles.tile, appStyles.homeFeatureTile, appStyles.tileYellow]} onPress={onOpenVibeCheck}>
          <Text style={appStyles.metaDate}>вайбчек</Text>
          <Text style={appStyles.itemTitle}>прожарка вкуса</Text>
          <Text style={appStyles.metaText}>когда контента накопится достаточно, можно получить уже не демо, а реальную читку.</Text>
        </Pressable>
      </View>
    </View>
  );
}

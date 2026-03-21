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
          <Text style={[appStyles.label, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>как тебя зовут?</Text>
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
        <Text style={[appStyles.helper, { color: theme.accentText }]}>
          здесь живут музыка, книги и фильмы, которые ты реально слушала, читала и смотрела. не список на потом, а след того,
          что с тобой происходило.
        </Text>
        <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>
          потом из этого получается библиотека, таймлайн вкуса и нормальный вайбчек, а не просто склад названий.
        </Text>
        <PillButton label="добавить контент" variant="primary" themeMode={themeMode} onPress={onAddPress} />
      </View>

      <View style={appStyles.tileGrid}>
        <Pressable style={[appStyles.tile, appStyles.homeFeatureTile, appStyles.tilePink]} onPress={() => onOpenLibraryType("music")}>
          <Text style={[appStyles.homeTileEyebrow, { color: theme.accentMutedText }]}>музыка</Text>
          <View style={appStyles.homeTileTextBlock}>
            <Text style={appStyles.homeTileTitle}>всё, что ты слушаешь</Text>
            <Text style={[appStyles.homeTileBody, { color: theme.accentMutedText }]}>
              подключи спотифай, импортируй из last.fm, загрузи по скриншоту или впиши вручную.
            </Text>
          </View>
        </Pressable>

        <Pressable style={[appStyles.tile, appStyles.homeFeatureTile, appStyles.tileGreen]} onPress={() => onOpenLibraryType("book")}>
          <Text style={[appStyles.homeTileEyebrow, { color: theme.accentMutedText }]}>книги</Text>
          <View style={appStyles.homeTileTextBlock}>
            <Text style={appStyles.homeTileTitle}>книжная полка</Text>
            <Text style={[appStyles.homeTileBody, { color: theme.accentMutedText }]}>
              скинь фотку книги или книжной полки, загрузи статистику из livelib или другого сервиса и посмотри, что будет.
            </Text>
          </View>
        </Pressable>

        <Pressable style={[appStyles.tile, appStyles.homeFeatureTile, appStyles.tileBlue]} onPress={() => onOpenLibraryType("film")}>
          <Text style={[appStyles.homeTileEyebrow, { color: theme.accentMutedText }]}>фильмы</Text>
          <View style={appStyles.homeTileTextBlock}>
            <Text style={appStyles.homeTileTitle}>все просмотры</Text>
            <Text style={[appStyles.homeTileBody, { color: theme.accentMutedText }]}>
              импортируй контент из letterboxd, кинопоиска, mubi и других уже подключенных площадок.
            </Text>
          </View>
        </Pressable>

        <Pressable style={[appStyles.tile, appStyles.homeFeatureTile, appStyles.tileYellow]} onPress={onOpenVibeCheck}>
          <Text style={[appStyles.homeTileEyebrow, { color: theme.accentMutedText }]}>вайбчек</Text>
          <View style={appStyles.homeTileTextBlock}>
            <Text style={appStyles.homeTileTitle}>узнай себя получше</Text>
            <Text style={[appStyles.homeTileBody, { color: theme.accentMutedText }]}>
              когда будешь готов — нажми кнопку «вайбчек» и сам всё поймешь.
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

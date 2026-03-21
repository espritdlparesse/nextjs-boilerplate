import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";

type HomeScreenProps = {
  hasCustomName: boolean;
  nameDraft: string;
  namePlaceholder: string;
  onAddPress: () => void;
  onNameDraftChange: (value: string) => void;
  onSaveNamePress: () => void;
};

export function HomeScreen({
  hasCustomName,
  nameDraft,
  namePlaceholder,
  onAddPress,
  onNameDraftChange,
  onSaveNamePress,
}: HomeScreenProps) {
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
      {editingName ? (
        <View style={[appStyles.card, appStyles.cardAccentYellow]}>
          <Text style={appStyles.label}>как тебя зовут?</Text>
          <TextInput
            style={appStyles.input}
            placeholder={namePlaceholder}
            value={nameDraft}
            onChangeText={onNameDraftChange}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <PillButton
            label={hasCustomName ? "обновить имя" : "сохранить имя"}
            variant="primary"
            disabled={!nameDraft.trim()}
            onPress={() => {
              onSaveNamePress();
              setEditingName(false);
            }}
          />
        </View>
      ) : (
        <View style={[appStyles.card, appStyles.compactNameCard]}>
          <View style={appStyles.compactNameRow}>
            <View style={appStyles.compactNameTextWrap}>
              <Text style={appStyles.label}>обращение</Text>
              <Text style={appStyles.helper}>можно поменять имя в любой момент</Text>
            </View>
            <PillButton label="изменить имя" onPress={() => setEditingName(true)} />
          </View>
        </View>
      )}

      <View style={[appStyles.sectionHero, appStyles.sectionHeroAlt]}>
        <Text style={appStyles.sectionTitle}>what is this</Text>
        <Text style={appStyles.helper}>
          здесь живут музыка, книги и фильмы, которые ты реально слушала, читала и смотрела. не список на потом, а след того,
          что с тобой происходило.
        </Text>
        <Text style={appStyles.metaText}>
          потом из этого получается библиотека, таймлайн вкуса и нормальный вайбчек, а не просто склад названий.
        </Text>
        <PillButton label="добавить контент" variant="primary" onPress={onAddPress} />
      </View>

      <View style={appStyles.tileGrid}>
        <View style={[appStyles.tile, appStyles.libraryTile, appStyles.tilePink]}>
          <Text style={appStyles.metaDate}>музыка</Text>
          <Text style={appStyles.itemTitle}>трек за треком</Text>
          <Text style={appStyles.metaText}>spotify, last.fm, скриншоты и ручной импорт.</Text>
        </View>

        <View style={[appStyles.tile, appStyles.libraryTile, appStyles.tileGreen]}>
          <Text style={appStyles.metaDate}>книги</Text>
          <Text style={appStyles.itemTitle}>книжная полка</Text>
          <Text style={appStyles.metaText}>livelib и другие экспортные файлы можно загрузить прямо здесь.</Text>
        </View>

        <View style={[appStyles.tile, appStyles.libraryTile, appStyles.tileBlue]}>
          <Text style={appStyles.metaDate}>фильмы</Text>
          <Text style={appStyles.itemTitle}>все просмотры</Text>
          <Text style={appStyles.metaText}>letterboxd, кинопоиск, mubi и любые странные списки через screenshot import.</Text>
        </View>

        <View style={[appStyles.tile, appStyles.libraryTile, appStyles.tileYellow]}>
          <Text style={appStyles.metaDate}>вайбчек</Text>
          <Text style={appStyles.itemTitle}>прожарка вкуса</Text>
          <Text style={appStyles.metaText}>когда контента накопится достаточно, можно получить уже не демо, а реальную читку.</Text>
        </View>
      </View>
    </View>
  );
}

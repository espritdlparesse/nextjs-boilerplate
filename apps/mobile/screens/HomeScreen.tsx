import { Text, TextInput, View } from "react-native";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";

type HomeScreenProps = {
  displayName: string;
  hasCustomName: boolean;
  nameDraft: string;
  onAddPress: () => void;
  onNameDraftChange: (value: string) => void;
  onSaveNamePress: () => void;
};

export function HomeScreen({
  displayName,
  hasCustomName,
  nameDraft,
  onAddPress,
  onNameDraftChange,
  onSaveNamePress,
}: HomeScreenProps) {
  return (
    <View style={appStyles.screen}>
      <View style={[appStyles.card, appStyles.cardAccentYellow]}>
        <Text style={appStyles.label}>{hasCustomName ? "обращение" : "как тебя зовут?"}</Text>
        <Text style={appStyles.helper}>
          {hasCustomName
            ? `сейчас приложение обращается к тебе как к ${displayName.toLowerCase()}. если хочешь, можно поменять это здесь.`
            : "введи имя, и приложение будет обращаться к тебе нормально, а не как к ios friend."}
        </Text>
        <TextInput
          style={appStyles.input}
          placeholder="например: настя"
          value={nameDraft}
          onChangeText={onNameDraftChange}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <PillButton
          label={hasCustomName ? "обновить имя" : "сохранить имя"}
          variant="primary"
          disabled={!nameDraft.trim()}
          onPress={onSaveNamePress}
        />
      </View>

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

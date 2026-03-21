import { Image, Text, TextInput, View } from "react-native";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";

type ProfileScreenProps = {
  displayName: string;
  nameDraft: string;
  avatarUri: string | null;
  totalItems: number;
  musicCount: number;
  bookCount: number;
  filmCount: number;
  exactCount: number;
  importedCount: number;
  estimatedCount: number;
  undatedCount: number;
  onNameDraftChange: (value: string) => void;
  onSaveNamePress: () => void;
  onPickAvatarPress: () => void;
  onClearAvatarPress: () => void;
};

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "e";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ProfileScreen({
  displayName,
  nameDraft,
  avatarUri,
  totalItems,
  musicCount,
  bookCount,
  filmCount,
  exactCount,
  importedCount,
  estimatedCount,
  undatedCount,
  onNameDraftChange,
  onSaveNamePress,
  onPickAvatarPress,
  onClearAvatarPress,
}: ProfileScreenProps) {
  return (
    <View style={appStyles.screen}>
      <View style={[appStyles.card, appStyles.cardAccentPink]}>
        <Text style={appStyles.sectionTitle}>профиль</Text>
        <View style={appStyles.profileHero}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={appStyles.profileAvatarImage} />
          ) : (
            <View style={appStyles.profileAvatar}>
              <Text style={appStyles.profileAvatarText}>{initialsFromName(displayName)}</Text>
            </View>
          )}
          <View style={appStyles.profileHeroText}>
            <Text style={appStyles.itemTitle}>{displayName.toLowerCase()}</Text>
            <Text style={appStyles.metaText}>
              {avatarUri ? "аватар загружен" : "тут можно добавить аватар и собрать свой культурный профиль"}
            </Text>
          </View>
        </View>
        <View style={appStyles.row}>
          <PillButton label="загрузить аватар" onPress={onPickAvatarPress} />
          {avatarUri ? <PillButton label="убрать аватар" onPress={onClearAvatarPress} /> : null}
        </View>
      </View>

      <View style={appStyles.card}>
        <Text style={appStyles.label}>имя</Text>
        <TextInput
          style={appStyles.input}
          placeholder="как к тебе обращаться"
          value={nameDraft}
          onChangeText={onNameDraftChange}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <PillButton label="сохранить имя" variant="primary" disabled={!nameDraft.trim()} onPress={onSaveNamePress} />
      </View>

      <View style={[appStyles.card, appStyles.cardAccentBlue]}>
        <Text style={appStyles.label}>анатомия вкуса</Text>
        <View style={appStyles.profileStatsGrid}>
          <View style={appStyles.profileStatTile}>
            <Text style={appStyles.profileStatValue}>{totalItems}</Text>
            <Text style={appStyles.profileStatLabel}>всего</Text>
          </View>
          <View style={appStyles.profileStatTile}>
            <Text style={appStyles.profileStatValue}>{musicCount}</Text>
            <Text style={appStyles.profileStatLabel}>музыка</Text>
          </View>
          <View style={appStyles.profileStatTile}>
            <Text style={appStyles.profileStatValue}>{bookCount}</Text>
            <Text style={appStyles.profileStatLabel}>книги</Text>
          </View>
          <View style={appStyles.profileStatTile}>
            <Text style={appStyles.profileStatValue}>{filmCount}</Text>
            <Text style={appStyles.profileStatLabel}>фильмы</Text>
          </View>
        </View>
      </View>

      <View style={[appStyles.card, appStyles.cardAccentGreen]}>
        <Text style={appStyles.label}>качество таймлайна</Text>
        <Text style={appStyles.helper}>
          точные даты: {exactCount}, из импорта: {importedCount}, примерно: {estimatedCount}, без даты: {undatedCount}.
        </Text>
        <Text style={appStyles.metaText}>
          чем больше точных дат и дат из импорта, тем честнее календарь и тем тоньше потом работает вайбчек.
        </Text>
      </View>

      <View style={appStyles.card}>
        <Text style={appStyles.label}>настройки</Text>
        <Text style={appStyles.helper}>темная тема и более глубокий анамнез будут жить здесь.</Text>
        <Text style={appStyles.metaText}>пока это отдельная тихая зона для профиля, имени, аватарки и общей статистики.</Text>
      </View>
    </View>
  );
}

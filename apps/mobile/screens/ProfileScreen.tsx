import { Image, Text, TextInput, View } from "react-native";
import { type ThemeMode } from "../shared/everyyou/domain";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";

type ProfileScreenProps = {
  themeMode: ThemeMode;
  displayName: string;
  nameDraft: string;
  avatarUri: string | null;
  telegramLink: {
    linked: boolean;
    telegramOwnerKey: string | null;
    code: string | null;
    expiresAt: string | null;
  };
  telegramLinkLoading: boolean;
  telegramLinkStatus: string | null;
  telegramLinkQrDataUrl: string | null;
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
  onThemeChange: (mode: ThemeMode) => void;
  onCreateTelegramLinkCode: () => void;
  onOpenTelegramLinkFlow: () => void;
  onReplayOnboarding: () => void;
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
  themeMode,
  displayName,
  nameDraft,
  avatarUri,
  telegramLink,
  telegramLinkLoading,
  telegramLinkStatus,
  telegramLinkQrDataUrl,
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
  onThemeChange,
  onCreateTelegramLinkCode,
  onOpenTelegramLinkFlow,
  onReplayOnboarding,
}: ProfileScreenProps) {
  const theme = getTheme(themeMode);

  return (
    <View style={appStyles.screen}>
      <View style={[appStyles.card, themeMode === "dark" ? { backgroundColor: theme.accentPink, borderColor: theme.border } : appStyles.cardAccentPink]}>
        <Text style={appStyles.sectionTitle}>профиль</Text>
        <View style={appStyles.profileHero}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={appStyles.profileAvatarImage} />
          ) : (
            <View style={[appStyles.profileAvatar, themeMode === "dark" && { backgroundColor: theme.text }]}>
              <Text style={[appStyles.profileAvatarText, themeMode === "dark" && { color: theme.background }]}>
                {initialsFromName(displayName)}
              </Text>
            </View>
          )}
          <View style={appStyles.profileHeroText}>
            <Text style={[appStyles.itemTitle, { color: theme.accentText }]}>{displayName.toLowerCase()}</Text>
            <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>
              {avatarUri ? "аватар загружен" : "тут можно добавить аватар и собрать свой культурный профиль"}
            </Text>
          </View>
        </View>
        <View style={appStyles.row}>
          <PillButton label="загрузить аватар" onPress={onPickAvatarPress} themeMode={themeMode} />
          {avatarUri ? <PillButton label="убрать аватар" onPress={onClearAvatarPress} themeMode={themeMode} /> : null}
        </View>
      </View>

      <View style={[appStyles.card, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[appStyles.label, { color: theme.mutedText }]}>имя</Text>
        <TextInput
          style={[
            appStyles.input,
            {
              backgroundColor: theme.inputBg,
              borderColor: theme.inputBorder,
              color: theme.inputText,
            },
          ]}
          placeholder="как к тебе обращаться"
          placeholderTextColor={theme.inputPlaceholder}
          value={nameDraft}
          onChangeText={onNameDraftChange}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <PillButton label="сохранить имя" variant="primary" themeMode={themeMode} disabled={!nameDraft.trim()} onPress={onSaveNamePress} />
      </View>

      <View style={[appStyles.card, themeMode === "dark" ? { backgroundColor: theme.accentBlue, borderColor: theme.border } : appStyles.cardAccentBlue]}>
        <Text style={[appStyles.label, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>анатомия вкуса</Text>
        <View style={appStyles.profileStatsGrid}>
          <View style={[appStyles.profileStatTile, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[appStyles.profileStatValue, { color: theme.text }]}>{totalItems}</Text>
            <Text style={[appStyles.profileStatLabel, { color: theme.mutedText }]}>всего</Text>
          </View>
          <View style={[appStyles.profileStatTile, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[appStyles.profileStatValue, { color: theme.text }]}>{musicCount}</Text>
            <Text style={[appStyles.profileStatLabel, { color: theme.mutedText }]}>музыка</Text>
          </View>
          <View style={[appStyles.profileStatTile, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[appStyles.profileStatValue, { color: theme.text }]}>{bookCount}</Text>
            <Text style={[appStyles.profileStatLabel, { color: theme.mutedText }]}>книги</Text>
          </View>
          <View style={[appStyles.profileStatTile, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[appStyles.profileStatValue, { color: theme.text }]}>{filmCount}</Text>
            <Text style={[appStyles.profileStatLabel, { color: theme.mutedText }]}>фильмы</Text>
          </View>
        </View>
      </View>

      <View style={[appStyles.card, themeMode === "dark" ? { backgroundColor: theme.accentGreen, borderColor: theme.border } : appStyles.cardAccentGreen]}>
        <Text style={[appStyles.label, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>качество таймлайна</Text>
        <Text style={[appStyles.helper, { color: theme.accentText }]}>
          точные даты: {exactCount}, из импорта: {importedCount}, примерно: {estimatedCount}, без даты: {undatedCount}.
        </Text>
        <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>
          чем больше точных дат и дат из импорта, тем честнее календарь и тем тоньше потом работает вайбчек.
        </Text>
      </View>

      <View style={[appStyles.card, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[appStyles.label, { color: theme.mutedText }]}>настройки</Text>
        <Text style={[appStyles.helper, { color: theme.text }]}>выбери, как тебе комфортнее смотреть на свой культурный таймлайн.</Text>
        <View style={appStyles.row}>
          <PillButton
            label="светлая"
            active={themeMode === "light"}
            themeMode={themeMode}
            onPress={() => onThemeChange("light")}
          />
          <PillButton
            label="темная"
            active={themeMode === "dark"}
            themeMode={themeMode}
            onPress={() => onThemeChange("dark")}
          />
        </View>
        <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
          потом сюда можно будет добавить еще темную тему, аватарку, анамнез вкуса и другие тихие настройки профиля.
        </Text>
        <PillButton label="посмотреть онбординг еще раз" onPress={onReplayOnboarding} themeMode={themeMode} />
      </View>

      <View style={[appStyles.card, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[appStyles.label, { color: theme.mutedText }]}>telegram</Text>
        <Text style={[appStyles.helper, { color: theme.text }]}>
          {telegramLink.linked
            ? "аккаунты уже связаны. теперь библиотека в Telegram и на айфоне общая."
            : "свяжи mini app и приложение на айфоне, чтобы библиотека, спотифай и вайбчеки жили как один аккаунт."}
        </Text>

        {telegramLink.linked ? (
          <Text style={[appStyles.metaText, { color: theme.mutedText }]}>telegram подключен</Text>
        ) : telegramLink.code ? (
          <View>
            <Text style={[appStyles.itemTitle, { color: theme.text, marginBottom: 8 }]}>{telegramLink.code}</Text>
            <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
              можешь сразу открыть mini app или показать qr на другом устройстве.
            </Text>
            {telegramLinkQrDataUrl ? (
              <View style={appStyles.telegramQrCard}>
                <Image source={{ uri: telegramLinkQrDataUrl }} style={appStyles.telegramQrImage} />
                <Text style={[appStyles.label, { color: theme.text }]}>qr для Telegram</Text>
                <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
                  qr сам откроет mini app и уже подставит код.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {telegramLinkStatus ? (
          <Text style={[appStyles.metaText, { color: theme.mutedText }]}>{telegramLinkStatus}</Text>
        ) : null}

        <View style={appStyles.row}>
          <PillButton
            label={telegramLinkLoading ? "готовим код..." : telegramLink.linked ? "обновить код" : "подключить Telegram"}
            onPress={onCreateTelegramLinkCode}
            themeMode={themeMode}
            disabled={telegramLinkLoading}
          />
          {telegramLink.code ? (
            <PillButton label="открыть mini app" onPress={onOpenTelegramLinkFlow} themeMode={themeMode} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

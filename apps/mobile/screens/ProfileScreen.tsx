import { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { type ThemeMode } from "../shared/everyyou/domain";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";

type ProfileScreenProps = {
  themeMode: ThemeMode;
  displayName: string;
  hasCustomName: boolean;
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
  movieCount: number;
  totalSteps: number;
  healthStepsEnabled: boolean;
  exactCount: number;
  importedCount: number;
  estimatedCount: number;
  undatedCount: number;
  onNameDraftChange: (value: string) => void;
  onSaveNamePress: () => void;
  onPickAvatarPress: () => void;
  onClearAvatarPress: () => void;
  onThemeChange: (mode: ThemeMode) => void;
  onHealthStepsEnabledChange: (value: boolean) => void;
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
  hasCustomName,
  nameDraft,
  avatarUri,
  telegramLink,
  telegramLinkLoading,
  telegramLinkStatus,
  telegramLinkQrDataUrl,
  totalItems,
  musicCount,
  bookCount,
  movieCount,
  totalSteps,
  healthStepsEnabled,
  exactCount,
  importedCount,
  estimatedCount,
  undatedCount,
  onNameDraftChange,
  onSaveNamePress,
  onPickAvatarPress,
  onClearAvatarPress,
  onThemeChange,
  onHealthStepsEnabledChange,
  onCreateTelegramLinkCode,
  onOpenTelegramLinkFlow,
  onReplayOnboarding,
}: ProfileScreenProps) {
  const theme = getTheme(themeMode);
  const [editingName, setEditingName] = useState(!hasCustomName);

  return (
    <View style={appStyles.screen}>
      <Pressable
        style={[appStyles.card, themeMode === "dark" ? { backgroundColor: theme.accentPink, borderColor: theme.border } : appStyles.cardAccentPink]}
        onPress={() => setEditingName(true)}
      >
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
            {hasCustomName ? (
              <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>нажми на карточку, чтобы поменять имя</Text>
            ) : null}
          </View>
        </View>
        <View style={appStyles.row}>
          <PillButton label="загрузить аватар" onPress={onPickAvatarPress} themeMode={themeMode} />
          {avatarUri ? <PillButton label="убрать аватар" onPress={onClearAvatarPress} themeMode={themeMode} /> : null}
        </View>
      </Pressable>

      {editingName ? (
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
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={appStyles.row}>
            {hasCustomName ? (
              <PillButton label="не сейчас" themeMode={themeMode} onPress={() => setEditingName(false)} />
            ) : null}
            <PillButton
              label="сохранить имя"
              variant="primary"
              themeMode={themeMode}
              disabled={!nameDraft.trim()}
              onPress={() => {
                onSaveNamePress();
                setEditingName(false);
              }}
            />
          </View>
        </View>
      ) : null}

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
            <Text style={[appStyles.profileStatValue, { color: theme.text }]}>{movieCount}</Text>
            <Text style={[appStyles.profileStatLabel, { color: theme.mutedText }]}>фильмы</Text>
          </View>
        </View>
      </View>

      <View style={[appStyles.card, themeMode === "dark" ? { backgroundColor: theme.accentGreen, borderColor: theme.border } : appStyles.cardAccentGreen]}>
        <Text style={[appStyles.label, { color: themeMode === "dark" ? theme.accentText : undefined }]}>как проставлены даты</Text>
        <Text style={[appStyles.helper, { color: theme.accentText }]}>
          точный день: {exactCount}, дата из сервиса: {importedCount}, разложили вручную: {estimatedCount}, пока без даты: {undatedCount}.
        </Text>
        <Text style={[appStyles.metaText, { color: themeMode === "dark" ? theme.accentText : theme.accentMutedText }]}>
          чем больше точных дат и дат из сервисов, тем честнее календарь и тем лучше потом работает вайбчек.
        </Text>
      </View>

      <View style={[appStyles.card, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[appStyles.label, { color: theme.mutedText }]}>здоровье</Text>
        <Text style={[appStyles.helper, { color: theme.text }]}>
          сюда можно будет подтянуть шаги с айфона и показывать их в календаре по дням.
        </Text>
        <View style={appStyles.row}>
          <PillButton
            label="шаги скрыты"
            active={!healthStepsEnabled}
            themeMode={themeMode}
            onPress={() => onHealthStepsEnabledChange(false)}
          />
          <PillButton
            label="показывать шаги"
            active={healthStepsEnabled}
            themeMode={themeMode}
            onPress={() => onHealthStepsEnabledChange(true)}
          />
        </View>
        <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
          сейчас это подготовка под интеграцию с приложением «здоровье». когда подключим healthkit, шаги появятся здесь и в календаре.
        </Text>
        <Text style={[appStyles.metaText, { color: theme.mutedText }]}>всего шагов в сохраненном слое: {totalSteps}</Text>
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
            : telegramLink.code
              ? "код уже готов. просто открой mini app, и мы попробуем подставить его сами."
              : "свяжи mini app и приложение на айфоне, чтобы библиотека, спотифай и вайбчеки жили как один аккаунт."}
        </Text>

        {telegramLink.linked ? (
          <Text style={[appStyles.metaText, { color: theme.mutedText }]}>telegram подключен</Text>
        ) : telegramLink.code ? (
          <View>
            <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
              если mini app не откроется сам, можно ввести код вручную: {telegramLink.code}
            </Text>
          </View>
        ) : null}

        {telegramLinkStatus ? (
          <Text style={[appStyles.metaText, { color: theme.mutedText }]}>{telegramLinkStatus}</Text>
        ) : null}

        <View style={appStyles.row}>
          {!telegramLink.linked ? (
            <PillButton
              label={telegramLinkLoading ? "готовим код..." : "подключить Telegram"}
              onPress={onCreateTelegramLinkCode}
              themeMode={themeMode}
              disabled={telegramLinkLoading}
            />
          ) : null}
          {telegramLink.code || telegramLink.linked ? (
            <PillButton label="открыть mini app" onPress={onOpenTelegramLinkFlow} themeMode={themeMode} />
          ) : null}
        </View>
        {telegramLink.linked ? (
          <Pressable onPress={onCreateTelegramLinkCode} style={{ marginTop: 10 }}>
            <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
              переподключить Telegram
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

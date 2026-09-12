import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BrandLogo } from "./BrandLogo";
import { PillButton } from "./PillButton";
import { GUIDES, type GuideKey } from "./importGuides";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";
import { type ThemeMode } from "../shared/everyyou/domain";
import type { ProfilePlatform } from "../hooks/importTypes";

const PROFILE_FIELDS: Record<ProfilePlatform, { placeholder: string; hint: string; refreshLabel: string }> = {
  lastfm: {
    placeholder: "username last.fm",
    hint: "импортируем recent tracks из публичного last.fm профиля",
    refreshLabel: "обновить last.fm",
  },
  letterboxd: {
    placeholder: "username или ссылка на profile",
    hint: "public profile beta: лучше всего работает с открытым профилем",
    refreshLabel: "обновить letterboxd",
  },
};

function ProfileGuideFields({ platform, themeMode, value, onChange, onImport, onChooseCsv }: {
  platform: ProfilePlatform;
  themeMode: ThemeMode;
  value: string;
  onChange: (value: string) => void;
  onImport: () => void;
  onChooseCsv: () => void;
}) {
  const theme = getTheme(themeMode);
  const field = PROFILE_FIELDS[platform];

  return (
    <>
      <TextInput
        style={[appStyles.input, appStyles.compactInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
        placeholder={field.placeholder}
        placeholderTextColor={theme.inputPlaceholder}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={[appStyles.metaText, { color: theme.text }]}>{field.hint}</Text>
      <PillButton
        label={value.trim() ? field.refreshLabel : "импортировать профиль"}
        themeMode={themeMode}
        onPress={onImport}
      />
      <PillButton label="или выбрать csv" themeMode={themeMode} onPress={onChooseCsv} />
    </>
  );
}

export function ImportGuideModal({
  guide,
  onClose,
  themeMode,
  lastfmUsername,
  onLastfmUsernameChange,
  letterboxdProfile,
  onLetterboxdProfileChange,
  onProfileImport,
  onConfirm,
  spotifyOAuthLoading,
}: {
  guide: GuideKey | null;
  onClose: () => void;
  themeMode: ThemeMode;
  lastfmUsername: string;
  onLastfmUsernameChange: (value: string) => void;
  letterboxdProfile: string;
  onLetterboxdProfileChange: (value: string) => void;
  onProfileImport: (platform: ProfilePlatform) => void;
  onConfirm: () => void;
  spotifyOAuthLoading: boolean;
}) {
  const theme = getTheme(themeMode);
  const profilePlatform = guide === "lastfm" || guide === "letterboxd" ? guide : null;

  return (
    <Modal visible={Boolean(guide)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[appStyles.dayModalBackdrop, { backgroundColor: theme.overlay }]}>
        <View style={[appStyles.guideModalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {guide ? (
            <>
              <View style={appStyles.dayModalTopRow}>
                <View style={appStyles.dayModalHeading}>
                  <BrandLogo brand={guide} />
                  {GUIDES[guide].title ? (
                    <Text style={[appStyles.metaText, { color: theme.mutedText }]}>{GUIDES[guide].title}</Text>
                  ) : null}
                </View>
                <Pressable
                  style={[appStyles.modalClose, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                  onPress={onClose}
                >
                  <Text style={[appStyles.modalCloseText, { color: theme.text }]}>×</Text>
                </Pressable>
              </View>

              <ScrollView style={appStyles.dayModalScroll} contentContainerStyle={appStyles.dayModalContent} showsVerticalScrollIndicator={false}>
                <View style={[appStyles.instructionCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                  {GUIDES[guide].steps.map((step) => (
                    <Text key={step} style={[appStyles.metaText, { color: theme.text }]}>
                      • {step}
                    </Text>
                  ))}
                  {profilePlatform ? (
                    <ProfileGuideFields
                      platform={profilePlatform}
                      themeMode={themeMode}
                      value={profilePlatform === "lastfm" ? lastfmUsername : letterboxdProfile}
                      onChange={profilePlatform === "lastfm" ? onLastfmUsernameChange : onLetterboxdProfileChange}
                      onImport={() => onProfileImport(profilePlatform)}
                      onChooseCsv={onConfirm}
                    />
                  ) : (
                    <PillButton
                      label={GUIDES[guide].actionLabel}
                      themeMode={themeMode}
                      onPress={onConfirm}
                      disabled={guide === "spotify" && spotifyOAuthLoading}
                    />
                  )}
                </View>
              </ScrollView>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

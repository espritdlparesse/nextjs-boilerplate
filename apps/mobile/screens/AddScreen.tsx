import type { TimelineSpreadPreset } from "../hooks/timelineTypes";
import type { FilePlatform, ProfilePlatform } from "../hooks/importTypes";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  getManualCreatorPlaceholder,
  getManualTitlePlaceholder,
  PLACEHOLDERS,
  TYPE_LABEL,
  type ContentType,
  type SourceType,
  type ThemeMode,
} from "../shared/everyyou/domain";
import { BrandImportButton, DateInsightBlock, ImportStatusBlock, StatusChip } from "../components/importUi";
import type { GuideKey } from "../components/importGuides";
import { ImportGuideModal } from "../components/ImportGuideModal";
import { ScreenshotImportCard } from "../components/ScreenshotImportCard";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";

type SpotifyPlaylist = {
  id: string;
  name: string;
  trackCount: number;
};

type AddScreenProps = {
  themeMode: ThemeMode;
  editingId: string | null;
  isScreenshotImporting: boolean;
  importedCount: number;
  screenshotStatus: string | null;
  screenshotDateInsight: { title: string; body: string; meta?: string } | null;
  pendingImageItems: Array<{
    id: string;
    type: ContentType;
    source: SourceType;
    title: string;
    authorOrArtist: string;
    createdAt?: number;
    consumedAt?: number;
  }>;
  selectedPendingImageItem: {
    id: string;
    type: ContentType;
    source: SourceType;
    title: string;
    authorOrArtist: string;
    createdAt?: number;
    consumedAt?: number;
  } | null;
  confirmingPendingImageImport: boolean;
  spotifyUrl: string;
  spotifyStatus: string | null;
  spotifyDateInsight: { title: string; body: string; meta?: string } | null;
  spotifyConnected: boolean;
  spotifyProfileName: string | null;
  spotifyPlaylists: SpotifyPlaylist[];
  spotifyOAuthLoading: boolean;
  spotifyPlaylistLoading: boolean;
  lastfmUsername: string;
  letterboxdProfile: string;
  connectedSources: {
    lastfm: { profile: string; lastSyncedAt: string | null } | null;
    letterboxd: { profile: string; lastSyncedAt: string | null } | null;
  };
  fileImportStatus: string | null;
  fileImportDateInsight: { title: string; body: string; meta?: string } | null;
  type: ContentType | "";
  title: string;
  authorOrArtist: string;
  placeholderIndex: number;
  canSave: boolean;
  onScreenshotImportPress: () => void;
  onConfirmPendingImageImport: () => void;
  onCancelPendingImageImport: () => void;
  onRemovePendingImageItem: (id: string) => void;
  onSelectPendingImageItem: (id: string | null) => void;
  onUpdatePendingImageItem: (
    id: string,
    patch: Partial<{
      type: ContentType;
      title: string;
      authorOrArtist: string;
      consumedAt?: number;
    }>
  ) => void;
  onAssignPendingImageItem: (id: string, preset: TimelineSpreadPreset) => void;
  onSpotifyUrlChange: (value: string) => void;
  onSpotifyImportPress: () => void;
  onSpotifyConnectPress: () => void;
  onSpotifyRefreshPress: () => void;
  onSpotifyLoadPlaylistsPress: () => void;
  onSpotifyLikedSongsPress: () => void;
  onSpotifyRecentlyPlayedPress: () => void;
  onSpotifyPlaylistImportPress: (playlistId: string, playlistName: string) => void;
  onLastfmUsernameChange: (value: string) => void;
  onLetterboxdProfileChange: (value: string) => void;
  onLastfmProfileImportPress: () => void;
  onLetterboxdProfileImportPress: () => void;
  onDisconnectProfilePress: (platform: ProfilePlatform, deleteContent?: boolean) => void;
  onDisconnectSpotifyPress: (deleteContent?: boolean) => void;
  onPlatformFileImportPress: (platform: FilePlatform) => void;
  onTypeChange: (value: ContentType) => void;
  onSourceChange: (value: SourceType) => void;
  onTitleChange: (value: string) => void;
  onAuthorOrArtistChange: (value: string) => void;
  onSavePress: () => void;
  onCancelPress: () => void;
  onDone: () => void;
};

export function AddScreen({
  themeMode,
  editingId,
  isScreenshotImporting,
  importedCount,
  screenshotStatus,
  screenshotDateInsight,
  pendingImageItems,
  selectedPendingImageItem,
  confirmingPendingImageImport,
  spotifyUrl,
  spotifyStatus,
  spotifyDateInsight,
  spotifyConnected,
  spotifyProfileName,
  spotifyPlaylists,
  spotifyOAuthLoading,
  spotifyPlaylistLoading,
  lastfmUsername,
  letterboxdProfile,
  connectedSources,
  fileImportStatus,
  fileImportDateInsight,
  type,
  title,
  authorOrArtist,
  placeholderIndex,
  canSave,
  onScreenshotImportPress,
  onConfirmPendingImageImport,
  onCancelPendingImageImport,
  onRemovePendingImageItem,
  onSelectPendingImageItem,
  onUpdatePendingImageItem,
  onAssignPendingImageItem,
  onSpotifyUrlChange,
  onSpotifyImportPress,
  onSpotifyConnectPress,
  onSpotifyRefreshPress,
  onSpotifyLoadPlaylistsPress,
  onSpotifyLikedSongsPress,
  onSpotifyRecentlyPlayedPress,
  onSpotifyPlaylistImportPress,
  onLastfmUsernameChange,
  onLetterboxdProfileChange,
  onLastfmProfileImportPress,
  onLetterboxdProfileImportPress,
  onDisconnectProfilePress,
  onDisconnectSpotifyPress,
  onPlatformFileImportPress,
  onTypeChange,
  onSourceChange,
  onTitleChange,
  onAuthorOrArtistChange,
  onSavePress,
  onCancelPress,
  onDone,
}: AddScreenProps) {
  const theme = getTheme(themeMode);
  const [guide, setGuide] = useState<GuideKey | null>(null);
  const [showSpotifyPlaylists, setShowSpotifyPlaylists] = useState(false);
  const activeType = (type || "music") as ContentType;
  const currentPh = PLACEHOLDERS[activeType][placeholderIndex % PLACEHOLDERS[activeType].length];
  const manualExample = `${currentPh.authorOrArtist} — ${currentPh.title}`;
  const titlePlaceholder = editingId ? getManualTitlePlaceholder(activeType) : `например: ${currentPh.title}`;
  const creatorPlaceholder = editingId
    ? getManualCreatorPlaceholder(activeType)
    : `например: ${currentPh.authorOrArtist}`;

  function runGuideAction(currentGuide: GuideKey) {
    if (currentGuide === "spotify") {
      if (spotifyConnected) {
        onSpotifyRefreshPress();
      } else {
        onSpotifyConnectPress();
      }
      return;
    }
    onPlatformFileImportPress(currentGuide);
  }

  function confirmGuideAction() {
    if (!guide) return;
    const currentGuide = guide;
    setGuide(null);
    setTimeout(() => {
      runGuideAction(currentGuide);
    }, 80);
  }

  function confirmProfileImport(kind: "lastfm" | "letterboxd") {
    setGuide(null);
    setTimeout(() => {
      if (kind === "lastfm") {
        onLastfmProfileImportPress();
      } else {
        onLetterboxdProfileImportPress();
      }
    }, 80);
  }

  return (
    <View style={appStyles.screen}>
      {editingId ? null : (
        <ScreenshotImportCard
          themeMode={themeMode}
          isScreenshotImporting={isScreenshotImporting}
          importedCount={importedCount}
          screenshotStatus={screenshotStatus}
          screenshotDateInsight={screenshotDateInsight}
          pendingImageItems={pendingImageItems}
          selectedPendingImageItem={selectedPendingImageItem}
          confirmingPendingImageImport={confirmingPendingImageImport}
          onScreenshotImportPress={onScreenshotImportPress}
          onConfirmPendingImageImport={onConfirmPendingImageImport}
          onCancelPendingImageImport={onCancelPendingImageImport}
          onRemovePendingImageItem={onRemovePendingImageItem}
          onSelectPendingImageItem={onSelectPendingImageItem}
          onUpdatePendingImageItem={onUpdatePendingImageItem}
          onAssignPendingImageItem={onAssignPendingImageItem}
        />
      )}

      {editingId ? null : (
      <View style={[appStyles.card, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[appStyles.label, { color: theme.mutedText }]}>импорт из площадок</Text>
        <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
          можно выбирать файлы из «файлы», icloud drive и других подключенных источников.
        </Text>
        <View style={appStyles.row}>
          <BrandImportButton brand="spotify" hint="музыка" themeMode={themeMode} onPress={() => runGuideAction("spotify")} onHelpPress={() => setGuide("spotify")} />
          <BrandImportButton brand="livelib" hint="книги csv" themeMode={themeMode} onPress={() => runGuideAction("livelib")} onHelpPress={() => setGuide("livelib")} />
          <BrandImportButton brand="goodreads" hint="книги csv" themeMode={themeMode} onPress={() => runGuideAction("goodreads")} onHelpPress={() => setGuide("goodreads")} />
          <BrandImportButton brand="letterboxd" hint="public profile beta" themeMode={themeMode} onPress={() => setGuide("letterboxd")} onHelpPress={() => setGuide("letterboxd")} />
          <BrandImportButton brand="lastfm" hint="recent tracks beta" themeMode={themeMode} onPress={() => setGuide("lastfm")} onHelpPress={() => setGuide("lastfm")} />
          <BrandImportButton brand="kinopoisk" hint="просмотры csv" themeMode={themeMode} onPress={() => runGuideAction("kinopoisk")} onHelpPress={() => setGuide("kinopoisk")} />
          <BrandImportButton brand="mubi" hint="фильмы csv" themeMode={themeMode} onPress={() => runGuideAction("mubi")} onHelpPress={() => setGuide("mubi")} />
        </View>

        {connectedSources.lastfm || connectedSources.letterboxd || lastfmUsername.trim() || letterboxdProfile.trim() ? (
          <View style={appStyles.stack}>
            <Text style={[appStyles.label, { color: theme.mutedText }]}>обновить профили</Text>
            {connectedSources.lastfm ? (
              <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
                last.fm подключен: {connectedSources.lastfm.profile}
              </Text>
            ) : null}
            {connectedSources.letterboxd ? (
              <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
                letterboxd подключен: {connectedSources.letterboxd.profile}
              </Text>
            ) : null}
            <View style={appStyles.spotifyActionGrid}>
              {connectedSources.lastfm || lastfmUsername.trim() ? (
                <PillButton themeMode={themeMode} label="обновить last.fm" onPress={onLastfmProfileImportPress} />
              ) : null}
              {connectedSources.letterboxd || letterboxdProfile.trim() ? (
                <PillButton themeMode={themeMode} label="обновить letterboxd" onPress={onLetterboxdProfileImportPress} />
              ) : null}
            </View>
            {(connectedSources.lastfm || connectedSources.letterboxd || lastfmUsername.trim() || letterboxdProfile.trim()) ? (
              <View style={appStyles.spotifyDangerBlock}>
                <Text style={[appStyles.metaText, { color: theme.mutedText }]}>если нужно, можно отвязать профили и убрать их импорт из библиотеки</Text>
                <View style={appStyles.spotifyDangerRow}>
                  {connectedSources.lastfm || lastfmUsername.trim() ? (
                    <PillButton themeMode={themeMode} label="отвязать last.fm" onPress={() => onDisconnectProfilePress("lastfm")} />
                  ) : null}
                  {connectedSources.letterboxd || letterboxdProfile.trim() ? (
                    <>
                      <PillButton themeMode={themeMode} label="отвязать letterboxd" onPress={() => onDisconnectProfilePress("letterboxd")} />
                      <PillButton themeMode={themeMode} label="убрать импорт letterboxd" onPress={() => onDisconnectProfilePress("letterboxd", true)} />
                    </>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {fileImportStatus ? (
          <ImportStatusBlock title="что сейчас происходит" body={fileImportStatus} themeMode={themeMode} />
        ) : null}
        {spotifyStatus ? (
          <ImportStatusBlock title="spotify" body={spotifyStatus} themeMode={themeMode} />
        ) : null}

        <View style={appStyles.chipRow}>
          {spotifyConnected ? (
            <StatusChip text={`spotify подключен: ${spotifyProfileName ?? "аккаунт найден"}`} />
          ) : null}
        </View>
        {fileImportDateInsight ? <DateInsightBlock insight={fileImportDateInsight} /> : null}
        {spotifyDateInsight ? <DateInsightBlock insight={spotifyDateInsight} /> : null}
      </View>
      )}

      <View style={[appStyles.card, themeMode === "dark" ? { backgroundColor: theme.accentBlue, borderColor: theme.border } : appStyles.cardAccentBlue]}>
        <Text style={[appStyles.label, { color: theme.accentMutedText }]}>{editingId ? "редактирование" : "добавить вручную"}</Text>
        <View style={appStyles.row}>
          {(["music", "book", "movie"] as ContentType[]).map((value) => (
            <PillButton
              key={value}
              label={TYPE_LABEL[value]}
              active={type === value}
              themeMode={themeMode}
              onPress={() => {
                onTypeChange(value);
                if (!editingId) {
                  onSourceChange("manual");
                }
              }}
            />
          ))}
        </View>

        <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>
          {editingId ? "тут можно спокойно поправить название и автора или исполнителя." : `например: ${manualExample}`}
        </Text>

        <TextInput
          style={[appStyles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
          placeholder={titlePlaceholder}
          placeholderTextColor={theme.inputPlaceholder}
          value={title}
          onChangeText={onTitleChange}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={[appStyles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
          placeholder={creatorPlaceholder}
          placeholderTextColor={theme.inputPlaceholder}
          value={authorOrArtist}
          onChangeText={onAuthorOrArtistChange}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {!editingId ? (
          <PillButton
            label="добавить в библиотеку"
            variant="primary"
            themeMode={themeMode}
            disabled={!canSave}
            onPress={() => {
              onSavePress();
              onDone();
            }}
          />
        ) : (
          <>
            <PillButton
              label="сохранить"
              variant="primary"
              themeMode={themeMode}
              disabled={!canSave}
              onPress={() => {
                onSavePress();
                onDone();
              }}
            />
            <PillButton
              label="отмена"
              themeMode={themeMode}
              onPress={() => {
                onCancelPress();
                onDone();
              }}
            />
          </>
        )}
      </View>

      <View style={[appStyles.card, themeMode === "dark" ? { backgroundColor: theme.accentGreen, borderColor: theme.border } : appStyles.cardAccentGreen, appStyles.compactCard]}>
        <Text style={[appStyles.label, { color: theme.accentMutedText }]}>обновить spotify</Text>
        <View style={appStyles.spotifyActionGrid}>
          <PillButton themeMode={themeMode} label="обновить" onPress={onSpotifyRefreshPress} />
          <PillButton
            label={spotifyPlaylistLoading ? "грузим..." : spotifyPlaylists.length > 0 ? "обновить плейлисты" : "плейлисты"}
            themeMode={themeMode}
            onPress={() => {
              onSpotifyLoadPlaylistsPress();
              setShowSpotifyPlaylists(true);
            }}
            disabled={spotifyPlaylistLoading}
          />
          <PillButton themeMode={themeMode} label="любимые треки" onPress={onSpotifyLikedSongsPress} />
          <PillButton themeMode={themeMode} label="недавнее" onPress={onSpotifyRecentlyPlayedPress} />
        </View>

        <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>или импортируй плейлист или релиз по ссылке</Text>
        <TextInput
          style={[appStyles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
          placeholder="ссылка spotify или Яндекс.Музыки"
          placeholderTextColor={theme.inputPlaceholder}
          value={spotifyUrl}
          onChangeText={onSpotifyUrlChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <PillButton themeMode={themeMode} label="импортировать ссылку" onPress={onSpotifyImportPress} />

        {spotifyConnected ? (
          <View style={appStyles.spotifyDangerBlock}>
            <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>если нужно, можно отвязать spotify или убрать его импорт из библиотеки</Text>
            <View style={appStyles.spotifyDangerRow}>
              <PillButton
                themeMode={themeMode}
                label="отвязать spotify"
                onPress={() => onDisconnectSpotifyPress(false)}
                style={appStyles.spotifyDangerButton}
              />
              <PillButton
                themeMode={themeMode}
                label="убрать импорт spotify"
                onPress={() => onDisconnectSpotifyPress(true)}
                style={appStyles.spotifyDangerButton}
              />
            </View>
          </View>
        ) : null}

        {spotifyPlaylists.length > 0 ? (
          <View style={appStyles.stack}>
            <Pressable style={[appStyles.collapseButton, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => setShowSpotifyPlaylists((current) => !current)}>
              <Text style={[appStyles.collapseButtonText, { color: theme.text }]}>
                {showSpotifyPlaylists
                  ? `спрятать плейлисты (${spotifyPlaylists.length})`
                  : `показать плейлисты (${spotifyPlaylists.length})`}
              </Text>
            </Pressable>

            {showSpotifyPlaylists
              ? spotifyPlaylists.map((playlist) => (
                  <View key={playlist.id} style={[appStyles.tile, appStyles.tileGreen]}>
                    <Text style={appStyles.itemTitle}>{playlist.name}</Text>
                    <Text style={[appStyles.metaText, { color: theme.mutedText }]}>{playlist.trackCount} треков</Text>
                    <PillButton
                      label="импортировать плейлист"
                      themeMode={themeMode}
                      onPress={() => onSpotifyPlaylistImportPress(playlist.id, playlist.name)}
                    />
                  </View>
                ))
              : null}
          </View>
        ) : null}
      </View>

      <ImportGuideModal
        guide={guide}
        onClose={() => setGuide(null)}
        themeMode={themeMode}
        lastfmUsername={lastfmUsername}
        onLastfmUsernameChange={onLastfmUsernameChange}
        letterboxdProfile={letterboxdProfile}
        onLetterboxdProfileChange={onLetterboxdProfileChange}
        onProfileImport={confirmProfileImport}
        onConfirm={confirmGuideAction}
        spotifyOAuthLoading={spotifyOAuthLoading}
      />
    </View>
  );
}

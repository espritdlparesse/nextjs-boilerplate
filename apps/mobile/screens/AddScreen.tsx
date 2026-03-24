import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { PLACEHOLDERS, TYPE_LABEL, type ContentType, type SourceType, type ThemeMode } from "../shared/everyyou/domain";
import { BrandLogo } from "../components/BrandLogo";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";

type SpotifyPlaylist = {
  id: string;
  name: string;
  trackCount: number;
};

type GuideKey = "spotify" | "livelib" | "goodreads" | "letterboxd" | "lastfm" | "kinopoisk" | "mubi" | null;

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
  onAssignPendingImageItemThisMonth: (id: string) => void;
  onAssignPendingImageItemLastMonth: (id: string) => void;
  onAssignPendingImageItemLast6Months: (id: string) => void;
  onAssignPendingImageItemThisYear: (id: string) => void;
  onAssignPendingImageItemVeryOld: (id: string) => void;
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
  onLivelibImportPress: () => void;
  onGoodreadsImportPress: () => void;
  onLetterboxdImportPress: () => void;
  onLastfmImportPress: () => void;
  onKinopoiskImportPress: () => void;
  onMubiImportPress: () => void;
  onTypeChange: (value: ContentType) => void;
  onSourceChange: (value: SourceType) => void;
  onTitleChange: (value: string) => void;
  onAuthorOrArtistChange: (value: string) => void;
  onSavePress: () => void;
  onCancelPress: () => void;
  onDone: () => void;
};

const guides: Record<
  Exclude<GuideKey, null>,
  { logo: string; title?: string; steps: string[]; actionLabel: string }
> = {
  spotify: {
    logo: "spotify",
    steps: [
      "нажми подключить spotify и пройди логин в браузере",
      "вернись сюда и нажми обновить spotify",
      "после этого можно тянуть любимые треки, недавние прослушивания и свои плейлисты",
    ],
    actionLabel: "подключить / обновить spotify",
  },
  livelib: {
    logo: "livelib",
    title: "нужен csv",
    steps: [
      "у livelib нет одного понятного официального экспорта для нас, поэтому сейчас нужен уже готовый csv",
      "подойдет выгрузка через livelib-backup или любой csv, где есть название и автор",
      "потом просто выбери этот файл из «файлов»",
    ],
    actionLabel: "выбрать файл",
  },
  goodreads: {
    logo: "goodreads",
    title: "нужен csv",
    steps: [
      "в goodreads открой my books и найди import and export",
      "сделай export library, goodreads скачает csv",
      "потом просто выбери этот csv из файлов",
    ],
    actionLabel: "выбрать файл",
  },
  letterboxd: {
    logo: "letterboxd",
    title: "можно без csv",
    steps: [
      "вставь username или ссылку на публичный profile letterboxd",
      "мы попробуем забрать recent diary / watched через public rss",
      "если профиль закрыт или rss не поможет — всегда можно вернуться к watched.csv",
    ],
    actionLabel: "импортировать профиль",
  },
  lastfm: {
    logo: "last.fm",
    title: "recent tracks beta",
    steps: [
      "введи username last.fm и мы попробуем забрать recent tracks через api",
      "если у треков есть scrobble time, они сразу лягут в календарь по дням",
      "если этот способ не сработает, всегда можно загрузить csv",
    ],
    actionLabel: "импортировать профиль",
  },
  kinopoisk: {
    logo: "кинопоиск",
    title: "нужен csv",
    steps: [
      "если у тебя уже есть csv с просмотрами или оценками из кинопоиска, можно загрузить его сюда",
      "если в файле есть watched / isWatched / watched date, мы возьмем только просмотренное",
      "дальше просто выбери файл из «файлов»",
    ],
    actionLabel: "выбрать файл",
  },
  mubi: {
    logo: "mubi",
    title: "нужен csv",
    steps: [
      "если у тебя уже есть csv с просмотренными фильмами из mubi, можно загрузить его сюда",
      "лучше всего подходят колонки title или name, а еще year, director и дата просмотра, если она есть",
      "дальше просто выбери файл из «файлов»",
    ],
    actionLabel: "выбрать файл",
  },
};

function BrandImportButton({
  brand,
  hint,
  onPress,
  onHelpPress,
  themeMode,
}: {
  brand: Exclude<GuideKey, null>;
  hint: string;
  onPress: () => void;
  onHelpPress: () => void;
  themeMode: ThemeMode;
}) {
  const theme = getTheme(themeMode);
  return (
    <View style={[appStyles.brandButton, { backgroundColor: theme.brandButtonBg, borderColor: theme.brandButtonBorder }]}>
      <Pressable style={appStyles.brandHelpButton} onPress={onHelpPress}>
        <Text style={[appStyles.brandHelpButtonText, { color: theme.brandHintText }]}>?</Text>
      </Pressable>
      <Pressable style={appStyles.brandButtonMain} onPress={onPress}>
        <BrandLogo brand={brand} />
        <Text style={[appStyles.brandHint, { color: theme.brandHintText }]}>{hint}</Text>
      </Pressable>
    </View>
  );
}

function StatusChip({ text }: { text: string }) {
  return (
    <View style={appStyles.statusChip}>
      <Text style={appStyles.statusChipText}>{text}</Text>
    </View>
  );
}

function DateInsightBlock({ insight }: { insight: { title: string; body: string; meta?: string } }) {
  return (
    <View style={appStyles.dateInsightCard}>
      <Text style={appStyles.dateInsightTitle}>{insight.title}</Text>
      <Text style={appStyles.dateInsightBody}>{insight.body}</Text>
      {insight.meta ? <Text style={appStyles.metaText}>{insight.meta}</Text> : null}
    </View>
  );
}

function ImportStatusBlock({
  title,
  body,
  themeMode,
}: {
  title: string;
  body: string;
  themeMode: ThemeMode;
}) {
  const theme = getTheme(themeMode);
  return (
    <View
      style={[
        appStyles.importStatusCard,
        {
          backgroundColor: themeMode === "dark" ? theme.surfaceMuted : "#FFFFFF",
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[appStyles.importStatusTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[appStyles.importStatusBody, { color: theme.mutedText }]}>{body}</Text>
    </View>
  );
}

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
  onAssignPendingImageItemThisMonth,
  onAssignPendingImageItemLastMonth,
  onAssignPendingImageItemLast6Months,
  onAssignPendingImageItemThisYear,
  onAssignPendingImageItemVeryOld,
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
  onLivelibImportPress,
  onLetterboxdImportPress,
  onGoodreadsImportPress,
  onLastfmImportPress,
  onKinopoiskImportPress,
  onMubiImportPress,
  onTypeChange,
  onSourceChange,
  onTitleChange,
  onAuthorOrArtistChange,
  onSavePress,
  onCancelPress,
  onDone,
}: AddScreenProps) {
  const theme = getTheme(themeMode);
  const [guide, setGuide] = useState<GuideKey>(null);
  const [showSpotifyPlaylists, setShowSpotifyPlaylists] = useState(false);
  const activeType = (type || "music") as ContentType;
  const currentPh = PLACEHOLDERS[activeType][placeholderIndex % PLACEHOLDERS[activeType].length];

  function runGuideAction(currentGuide: Exclude<GuideKey, null>) {
    if (currentGuide === "spotify") {
      if (spotifyConnected) {
        onSpotifyRefreshPress();
      } else {
        onSpotifyConnectPress();
      }
      return;
    }
    if (currentGuide === "livelib") return onLivelibImportPress();
    if (currentGuide === "goodreads") return onGoodreadsImportPress();
    if (currentGuide === "letterboxd") return onLetterboxdImportPress();
    if (currentGuide === "lastfm") return onLastfmImportPress();
    if (currentGuide === "kinopoisk") return onKinopoiskImportPress();
    if (currentGuide === "mubi") return onMubiImportPress();
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
      <View style={[appStyles.card, themeMode === "dark" ? { backgroundColor: theme.accentPink, borderColor: theme.border } : appStyles.cardAccentPink]}>
        <Text style={appStyles.sectionTitle}>{editingId ? "редактировать" : "добавить"}</Text>
        <Text style={[appStyles.helper, { color: theme.accentText }]}>
          {pendingImageItems.length > 0
            ? "ткни на карточку, если хочешь поправить ее до сохранения."
            : "кидай скриншоты откуда угодно, фото книжной полки, обложки в магазине или добавляй вручную. мы попробуем собрать это в один культурный таймлайн."}
        </Text>
        <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>
          подойдут и скриншоты сервисов, и фото твоей книжной полки, и просто обложки книг, альбомов или постеров.
        </Text>

        <PillButton
          label={isScreenshotImporting ? "анализируем изображения..." : "загрузить изображения"}
          onPress={onScreenshotImportPress}
          themeMode={themeMode}
          disabled={isScreenshotImporting}
        />

        {screenshotStatus ? (
          <ImportStatusBlock title="что сейчас происходит" body={screenshotStatus} themeMode={themeMode} />
        ) : null}

        <View style={appStyles.chipRow}>
          <StatusChip text={`импортировано: ${importedCount} треков`} />
        </View>
        {screenshotDateInsight ? <DateInsightBlock insight={screenshotDateInsight} /> : null}

        {pendingImageItems.length > 0 ? (
          <View style={appStyles.stack}>
            <View style={appStyles.row}>
              <PillButton
                label={confirmingPendingImageImport ? "сохраняем..." : `сохранить ${pendingImageItems.length}`}
                variant="primary"
                themeMode={themeMode}
                disabled={confirmingPendingImageImport}
                onPress={onConfirmPendingImageImport}
              />
              <PillButton
                label="отмена"
                themeMode={themeMode}
                disabled={confirmingPendingImageImport}
                onPress={onCancelPendingImageImport}
              />
            </View>
            <View style={appStyles.previewGrid}>
              {pendingImageItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={[
                    appStyles.tile,
                    appStyles.previewTile,
                    appStyles.tileYellow,
                    selectedPendingImageItem?.id === item.id && appStyles.previewTileActive,
                  ]}
                  onPress={() => onSelectPendingImageItem(item.id)}
                >
                  <Text style={appStyles.previewType}>{TYPE_LABEL[item.type]}</Text>
                  <Text style={appStyles.previewTitle}>{item.title}</Text>
                  <Text style={appStyles.previewMeta}>{item.authorOrArtist}</Text>
                  <Pressable style={appStyles.previewRemoveChip} onPress={() => onRemovePendingImageItem(item.id)}>
                    <Text style={appStyles.previewRemoveChipText}>убрать</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
            {selectedPendingImageItem ? (
              <View style={[appStyles.instructionCard, appStyles.compactEditorCard, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={appStyles.editorTitle}>поправить карточку</Text>
                <View style={appStyles.row}>
                  {(["music", "book", "film"] as ContentType[]).map((value) => (
                    <PillButton
                      key={value}
                      label={TYPE_LABEL[value]}
                      active={selectedPendingImageItem.type === value}
                      themeMode={themeMode}
                      onPress={() =>
                        onUpdatePendingImageItem(selectedPendingImageItem.id, { type: value })
                      }
                    />
                  ))}
                </View>
                <TextInput
                  style={[appStyles.input, appStyles.compactInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
                  placeholder="название"
                  placeholderTextColor={theme.inputPlaceholder}
                  value={selectedPendingImageItem.title}
                  onChangeText={(value) =>
                    onUpdatePendingImageItem(selectedPendingImageItem.id, { title: value })
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={[appStyles.input, appStyles.compactInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
                  placeholder="автор, артист или режиссер"
                  placeholderTextColor={theme.inputPlaceholder}
                  value={selectedPendingImageItem.authorOrArtist}
                  onChangeText={(value) =>
                    onUpdatePendingImageItem(selectedPendingImageItem.id, { authorOrArtist: value })
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={[appStyles.metaText, { color: theme.mutedText }]}>когда это было примерно?</Text>
                <View style={appStyles.row}>
                  <PillButton themeMode={themeMode} label="недавно" onPress={() => onAssignPendingImageItemThisMonth(selectedPendingImageItem.id)} />
                  <PillButton themeMode={themeMode} label="прошлый месяц" onPress={() => onAssignPendingImageItemLastMonth(selectedPendingImageItem.id)} />
                  <PillButton themeMode={themeMode} label="полгода" onPress={() => onAssignPendingImageItemLast6Months(selectedPendingImageItem.id)} />
                  <PillButton themeMode={themeMode} label="этот год" onPress={() => onAssignPendingImageItemThisYear(selectedPendingImageItem.id)} />
                  <PillButton themeMode={themeMode} label="очень давно" onPress={() => onAssignPendingImageItemVeryOld(selectedPendingImageItem.id)} />
                </View>
              </View>
            ) : null}
            <View style={appStyles.row}>
              <PillButton
                label={confirmingPendingImageImport ? "сохраняем..." : `сохранить ${pendingImageItems.length}`}
                variant="primary"
                themeMode={themeMode}
                disabled={confirmingPendingImageImport}
                onPress={onConfirmPendingImageImport}
              />
              <PillButton
                label="отмена"
                themeMode={themeMode}
                disabled={confirmingPendingImageImport}
                onPress={onCancelPendingImageImport}
              />
            </View>
          </View>
        ) : null}
      </View>
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
            <View style={appStyles.row}>
              {connectedSources.lastfm || lastfmUsername.trim() ? (
                <PillButton themeMode={themeMode} label="обновить last.fm" onPress={onLastfmProfileImportPress} />
              ) : null}
              {connectedSources.letterboxd || letterboxdProfile.trim() ? (
                <PillButton themeMode={themeMode} label="обновить letterboxd" onPress={onLetterboxdProfileImportPress} />
              ) : null}
            </View>
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
          {(["music", "book", "film"] as ContentType[]).map((value) => (
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

        <TextInput
          style={[appStyles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
          placeholder={`например: ${currentPh.title}`}
          placeholderTextColor={theme.inputPlaceholder}
          value={title}
          onChangeText={onTitleChange}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={[appStyles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
          placeholder={`например: ${currentPh.authorOrArtist}`}
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
        <View style={appStyles.row}>
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

        <TextInput
          style={[appStyles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
          placeholder="ссылка на трек, альбом или плейлист"
          placeholderTextColor={theme.inputPlaceholder}
          value={spotifyUrl}
          onChangeText={onSpotifyUrlChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <PillButton themeMode={themeMode} label="импортировать ссылку" onPress={onSpotifyImportPress} />

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

      <Modal visible={Boolean(guide)} transparent animationType="fade" onRequestClose={() => setGuide(null)}>
        <View style={[appStyles.dayModalBackdrop, { backgroundColor: theme.overlay }]}>
          <View style={[appStyles.guideModalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {guide ? (
              <>
                <View style={appStyles.dayModalTopRow}>
                  <View style={appStyles.dayModalHeading}>
                    <BrandLogo brand={guide} />
                    {guides[guide].title ? (
                      <Text style={[appStyles.metaText, { color: theme.mutedText }]}>{guides[guide].title}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={[appStyles.dayModalClose, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                    onPress={() => setGuide(null)}
                  >
                    <Text style={[appStyles.dayModalCloseText, { color: theme.text }]}>закрыть</Text>
                  </Pressable>
                </View>

                <ScrollView style={appStyles.dayModalScroll} contentContainerStyle={appStyles.dayModalContent} showsVerticalScrollIndicator={false}>
                  <View style={[appStyles.instructionCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                    {guides[guide].steps.map((step) => (
                      <Text key={step} style={[appStyles.metaText, { color: theme.text }]}>
                        • {step}
                      </Text>
                    ))}
                    {guide === "lastfm" ? (
                      <>
                        <TextInput
                          style={[appStyles.input, appStyles.compactInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
                          placeholder="username last.fm"
                          placeholderTextColor={theme.inputPlaceholder}
                          value={lastfmUsername}
                          onChangeText={onLastfmUsernameChange}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <Text style={[appStyles.metaText, { color: theme.text }]}>
                          импортируем recent tracks из публичного last.fm профиля
                        </Text>
                        <PillButton
                          label={lastfmUsername.trim() ? "обновить last.fm" : "импортировать профиль"}
                          themeMode={themeMode}
                          onPress={() => confirmProfileImport("lastfm")}
                        />
                        <PillButton label="или выбрать csv" themeMode={themeMode} onPress={confirmGuideAction} />
                      </>
                    ) : null}
                    {guide === "letterboxd" ? (
                      <>
                        <TextInput
                          style={[appStyles.input, appStyles.compactInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
                          placeholder="username или ссылка на profile"
                          placeholderTextColor={theme.inputPlaceholder}
                          value={letterboxdProfile}
                          onChangeText={onLetterboxdProfileChange}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <Text style={[appStyles.metaText, { color: theme.text }]}>
                          public profile beta: лучше всего работает с открытым профилем
                        </Text>
                        <PillButton
                          label={letterboxdProfile.trim() ? "обновить letterboxd" : "импортировать профиль"}
                          themeMode={themeMode}
                          onPress={() => confirmProfileImport("letterboxd")}
                        />
                        <PillButton label="или выбрать csv" themeMode={themeMode} onPress={confirmGuideAction} />
                      </>
                    ) : null}
                    {guide !== "lastfm" && guide !== "letterboxd" ? (
                    <PillButton
                      label={guides[guide].actionLabel}
                      themeMode={themeMode}
                      onPress={confirmGuideAction}
                      disabled={guide === "spotify" && spotifyOAuthLoading}
                    />
                    ) : null}
                  </View>
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

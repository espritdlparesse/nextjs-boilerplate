import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
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

type GuideKey = "spotify" | "livelib" | "letterboxd" | "lastfm" | "kinopoisk" | "mubi" | null;

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
  onLivelibImportPress: () => void;
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

const guides: Record<Exclude<GuideKey, null>, { logo: string; steps: string[]; actionLabel: string }> = {
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
    steps: [
      "экспортируй свою библиотеку в csv через livelib-backup",
      "убедись, что в файле есть название и автор",
      "потом нажми кнопку ниже и выбери csv из файлов",
    ],
    actionLabel: "ок, импортировать livelib",
  },
  letterboxd: {
    logo: "letterboxd",
    steps: [
      "в профиле letterboxd зайди в settings -> import & export",
      "скачай экспорт и найди watched.csv",
      "потом вернись сюда и загрузи файл",
    ],
    actionLabel: "ок, импортировать letterboxd",
  },
  lastfm: {
    logo: "last.fm",
    steps: [
      "подготовь csv со столбцами трека и исполнителя",
      "если это экспорт скробблов, мы сами уберем дубли по треку и исполнителю",
      "потом просто выбери файл в файловом менеджере",
    ],
    actionLabel: "ок, импортировать last.fm",
  },
  kinopoisk: {
    logo: "кинопоиск",
    steps: [
      "выгрузи список просмотров или оценок в csv",
      "если в файле есть watched/isWatched, мы возьмем только просмотренное",
      "затем выбери файл здесь",
    ],
    actionLabel: "ок, импортировать кинопоиск",
  },
  mubi: {
    logo: "mubi",
    steps: [
      "подготовь csv с колонками title или name, можно с year и director",
      "если это файл из community export tool, он тоже должен подойти",
      "потом просто выбери его в files",
    ],
    actionLabel: "ок, импортировать mubi",
  },
};

function BrandImportButton({
  brand,
  hint,
  onPress,
  themeMode,
}: {
  brand: Exclude<GuideKey, null>;
  hint: string;
  onPress: () => void;
  themeMode: ThemeMode;
}) {
  const theme = getTheme(themeMode);
  return (
    <Pressable
      style={[appStyles.brandButton, { backgroundColor: theme.brandButtonBg, borderColor: theme.brandButtonBorder }]}
      onPress={onPress}
    >
      <BrandLogo brand={brand} />
      <Text style={[appStyles.brandHint, { color: theme.brandHintText }]}>{hint}</Text>
    </Pressable>
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
  onLivelibImportPress,
  onLetterboxdImportPress,
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

  function runGuideAction() {
    if (guide === "spotify") {
      if (spotifyConnected) {
        onSpotifyRefreshPress();
      } else {
        onSpotifyConnectPress();
      }
      return;
    }
    if (guide === "livelib") return onLivelibImportPress();
    if (guide === "letterboxd") return onLetterboxdImportPress();
    if (guide === "lastfm") return onLastfmImportPress();
    if (guide === "kinopoisk") return onKinopoiskImportPress();
    if (guide === "mubi") return onMubiImportPress();
  }

  return (
    <View style={appStyles.screen}>
      <View style={[appStyles.card, themeMode === "dark" ? { backgroundColor: theme.accentPink, borderColor: theme.border } : appStyles.cardAccentPink]}>
        <Text style={appStyles.sectionTitle}>{editingId ? "редактировать" : "добавить"}</Text>
        <Text style={[appStyles.helper, { color: theme.accentText }]}>
          {pendingImageItems.length > 0
            ? "ткни на карточку, если хочешь поправить ее до сохранения."
            : "импортируй из сервисов, кидай скриншот или добавляй вручную. все должно ощущаться как один культурный таймлайн, а не куча отдельных списков."}
        </Text>

        <PillButton
          label={isScreenshotImporting ? "анализируем изображения..." : "загрузить изображения"}
          onPress={onScreenshotImportPress}
          themeMode={themeMode}
          disabled={isScreenshotImporting}
        />

        <View style={appStyles.chipRow}>
          <StatusChip text={`импортировано: ${importedCount} треков`} />
          {screenshotStatus ? <StatusChip text={screenshotStatus} /> : null}
        </View>
        {screenshotDateInsight ? <DateInsightBlock insight={screenshotDateInsight} /> : null}

        {pendingImageItems.length > 0 ? (
          <View style={appStyles.stack}>
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

      <View style={[appStyles.card, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[appStyles.label, { color: theme.mutedText }]}>импорт из площадок</Text>
        <View style={appStyles.row}>
          <BrandImportButton brand="spotify" hint="музыка сама" themeMode={themeMode} onPress={() => setGuide("spotify")} />
          <BrandImportButton brand="livelib" hint="книги csv" themeMode={themeMode} onPress={() => setGuide("livelib")} />
          <BrandImportButton brand="letterboxd" hint="фильмы csv" themeMode={themeMode} onPress={() => setGuide("letterboxd")} />
          <BrandImportButton brand="lastfm" hint="история треков" themeMode={themeMode} onPress={() => setGuide("lastfm")} />
          <BrandImportButton brand="kinopoisk" hint="просмотры csv" themeMode={themeMode} onPress={() => setGuide("kinopoisk")} />
          <BrandImportButton brand="mubi" hint="фильмы csv" themeMode={themeMode} onPress={() => setGuide("mubi")} />
        </View>

        {guide ? (
          <View style={[appStyles.instructionCard, themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <Text style={[appStyles.itemTitle, { color: theme.text }]}>{guides[guide].logo}</Text>
            {guides[guide].steps.map((step) => (
              <Text key={step} style={[appStyles.metaText, { color: theme.text }]}>
                • {step}
              </Text>
            ))}
            <PillButton
              label={guides[guide].actionLabel}
              themeMode={themeMode}
              onPress={runGuideAction}
              disabled={guide === "spotify" && spotifyOAuthLoading}
            />
          </View>
        ) : null}

        <View style={appStyles.chipRow}>
          {spotifyConnected ? (
            <StatusChip text={`spotify подключен: ${spotifyProfileName ?? "аккаунт найден"}`} />
          ) : null}
          {fileImportStatus ? <StatusChip text={fileImportStatus} /> : null}
          {spotifyStatus ? <StatusChip text={spotifyStatus} /> : null}
        </View>
        {fileImportDateInsight ? <DateInsightBlock insight={fileImportDateInsight} /> : null}
        {spotifyDateInsight ? <DateInsightBlock insight={spotifyDateInsight} /> : null}
      </View>

      <View style={[appStyles.card, themeMode === "dark" ? { backgroundColor: theme.accentBlue, borderColor: theme.border } : appStyles.cardAccentBlue]}>
        <Text style={[appStyles.label, { color: theme.accentMutedText }]}>добавить вручную</Text>
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
    </View>
  );
}

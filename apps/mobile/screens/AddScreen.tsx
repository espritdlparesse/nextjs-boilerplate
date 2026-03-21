import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { PLACEHOLDERS, TYPE_LABEL, type ContentType, type SourceType } from "../shared/everyyou/domain";
import { BrandLogo } from "../components/BrandLogo";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";

type SpotifyPlaylist = {
  id: string;
  name: string;
  trackCount: number;
};

type GuideKey = "spotify" | "livelib" | "letterboxd" | "lastfm" | "kinopoisk" | "mubi" | null;

type AddScreenProps = {
  editingId: string | null;
  isScreenshotImporting: boolean;
  importedCount: number;
  screenshotStatus: string | null;
  spotifyUrl: string;
  spotifyStatus: string | null;
  spotifyConnected: boolean;
  spotifyProfileName: string | null;
  spotifyPlaylists: SpotifyPlaylist[];
  spotifyOAuthLoading: boolean;
  spotifyPlaylistLoading: boolean;
  fileImportStatus: string | null;
  type: ContentType | "";
  title: string;
  authorOrArtist: string;
  placeholderIndex: number;
  canSave: boolean;
  onScreenshotImportPress: () => void;
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
      "после этого можно тянуть liked songs, recently played и свои плейлисты",
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
      "если это экспорт скробблов, мы сами уберем дубли по track + artist",
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
}: {
  brand: Exclude<GuideKey, null>;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={appStyles.brandButton} onPress={onPress}>
      <BrandLogo brand={brand} />
      <Text style={appStyles.brandHint}>{hint}</Text>
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

export function AddScreen({
  editingId,
  isScreenshotImporting,
  importedCount,
  screenshotStatus,
  spotifyUrl,
  spotifyStatus,
  spotifyConnected,
  spotifyProfileName,
  spotifyPlaylists,
  spotifyOAuthLoading,
  spotifyPlaylistLoading,
  fileImportStatus,
  type,
  title,
  authorOrArtist,
  placeholderIndex,
  canSave,
  onScreenshotImportPress,
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
      <View style={[appStyles.card, appStyles.cardAccentPink]}>
        <Text style={appStyles.sectionTitle}>{editingId ? "редактировать" : "добавить"}</Text>
        <Text style={appStyles.helper}>импортируй из сервисов, кидай скриншот или добавляй вручную. все должно ощущаться как один культурный таймлайн, а не куча отдельных списков.</Text>

        <PillButton
          label={isScreenshotImporting ? "анализируем изображения..." : "загрузить изображения"}
          onPress={onScreenshotImportPress}
          disabled={isScreenshotImporting}
        />

        <View style={appStyles.chipRow}>
          <StatusChip text={`импортировано: ${importedCount} треков`} />
          {screenshotStatus ? <StatusChip text={screenshotStatus} /> : null}
        </View>
      </View>

      <View style={appStyles.card}>
        <Text style={appStyles.label}>импорт из площадок</Text>
        <View style={appStyles.row}>
          <BrandImportButton brand="spotify" hint="музыка сама" onPress={() => setGuide("spotify")} />
          <BrandImportButton brand="livelib" hint="книги csv" onPress={() => setGuide("livelib")} />
          <BrandImportButton brand="letterboxd" hint="фильмы csv" onPress={() => setGuide("letterboxd")} />
          <BrandImportButton brand="lastfm" hint="история треков" onPress={() => setGuide("lastfm")} />
          <BrandImportButton brand="kinopoisk" hint="просмотры csv" onPress={() => setGuide("kinopoisk")} />
          <BrandImportButton brand="mubi" hint="фильмы csv" onPress={() => setGuide("mubi")} />
        </View>

        {guide ? (
          <View style={appStyles.instructionCard}>
            <Text style={appStyles.itemTitle}>{guides[guide].logo}</Text>
            {guides[guide].steps.map((step) => (
              <Text key={step} style={appStyles.metaText}>
                • {step}
              </Text>
            ))}
            <PillButton
              label={guides[guide].actionLabel}
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
      </View>

      <View style={[appStyles.card, appStyles.cardAccentBlue]}>
        <Text style={appStyles.label}>добавить вручную</Text>
        <View style={appStyles.row}>
          {(["music", "book", "film"] as ContentType[]).map((value) => (
            <PillButton
              key={value}
              label={TYPE_LABEL[value]}
              active={type === value}
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
          style={appStyles.input}
          placeholder={`например: ${currentPh.title}`}
          value={title}
          onChangeText={onTitleChange}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={appStyles.input}
          placeholder={`например: ${currentPh.authorOrArtist}`}
          value={authorOrArtist}
          onChangeText={onAuthorOrArtistChange}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {!editingId ? (
          <PillButton
            label="добавить в библиотеку"
            variant="primary"
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
              disabled={!canSave}
              onPress={() => {
                onSavePress();
                onDone();
              }}
            />
            <PillButton
              label="отмена"
              onPress={() => {
                onCancelPress();
                onDone();
              }}
            />
          </>
        )}
      </View>

      <View style={[appStyles.card, appStyles.cardAccentGreen, appStyles.compactCard]}>
        <Text style={appStyles.label}>обновить spotify</Text>
        <View style={appStyles.row}>
          <PillButton label="обновить" onPress={onSpotifyRefreshPress} />
          <PillButton
            label={spotifyPlaylistLoading ? "грузим..." : spotifyPlaylists.length > 0 ? "обновить плейлисты" : "плейлисты"}
            onPress={() => {
              onSpotifyLoadPlaylistsPress();
              setShowSpotifyPlaylists(true);
            }}
            disabled={spotifyPlaylistLoading}
          />
          <PillButton label="liked songs" onPress={onSpotifyLikedSongsPress} />
          <PillButton label="recently played" onPress={onSpotifyRecentlyPlayedPress} />
        </View>

        <TextInput
          style={appStyles.input}
          placeholder="spotify track, album или playlist link"
          value={spotifyUrl}
          onChangeText={onSpotifyUrlChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <PillButton label="импортировать ссылку" onPress={onSpotifyImportPress} />

        {spotifyPlaylists.length > 0 ? (
          <View style={appStyles.stack}>
            <Pressable style={appStyles.collapseButton} onPress={() => setShowSpotifyPlaylists((current) => !current)}>
              <Text style={appStyles.collapseButtonText}>
                {showSpotifyPlaylists
                  ? `спрятать плейлисты (${spotifyPlaylists.length})`
                  : `показать плейлисты (${spotifyPlaylists.length})`}
              </Text>
            </Pressable>

            {showSpotifyPlaylists
              ? spotifyPlaylists.map((playlist) => (
                  <View key={playlist.id} style={[appStyles.tile, appStyles.tileGreen]}>
                    <Text style={appStyles.itemTitle}>{playlist.name}</Text>
                    <Text style={appStyles.metaText}>{playlist.trackCount} треков</Text>
                    <PillButton
                      label="импортировать плейлист"
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

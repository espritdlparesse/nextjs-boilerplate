import { Text, TextInput, View } from "react-native";
import { PLACEHOLDERS, SOURCE_LABEL, TYPE_LABEL, type ContentType, type SourceType } from "../shared/everyyou/domain";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";

type SpotifyPlaylist = {
  id: string;
  name: string;
  trackCount: number;
};

type AddScreenProps = {
  editingId: string | null;
  isImporting: boolean;
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
  type: ContentType | "";
  source: SourceType | "";
  title: string;
  authorOrArtist: string;
  placeholderIndex: number;
  canSave: boolean;
  onImportPress: () => void;
  onScreenshotImportPress: () => void;
  onSpotifyUrlChange: (value: string) => void;
  onSpotifyImportPress: () => void;
  onSpotifyConnectPress: () => void;
  onSpotifyRefreshPress: () => void;
  onSpotifyLoadPlaylistsPress: () => void;
  onSpotifyLikedSongsPress: () => void;
  onSpotifyRecentlyPlayedPress: () => void;
  onSpotifyPlaylistImportPress: (playlistId: string, playlistName: string) => void;
  onTypeChange: (value: ContentType) => void;
  onSourceChange: (value: SourceType) => void;
  onTitleChange: (value: string) => void;
  onAuthorOrArtistChange: (value: string) => void;
  onSavePress: () => void;
  onCancelPress: () => void;
  onDone: () => void;
};

export function AddScreen({
  editingId,
  isImporting,
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
  type,
  source,
  title,
  authorOrArtist,
  placeholderIndex,
  canSave,
  onImportPress,
  onScreenshotImportPress,
  onSpotifyUrlChange,
  onSpotifyImportPress,
  onSpotifyConnectPress,
  onSpotifyRefreshPress,
  onSpotifyLoadPlaylistsPress,
  onSpotifyLikedSongsPress,
  onSpotifyRecentlyPlayedPress,
  onSpotifyPlaylistImportPress,
  onTypeChange,
  onSourceChange,
  onTitleChange,
  onAuthorOrArtistChange,
  onSavePress,
  onCancelPress,
  onDone,
}: AddScreenProps) {
  const activeType = (type || "music") as ContentType;
  const currentPh = PLACEHOLDERS[activeType][placeholderIndex % PLACEHOLDERS[activeType].length];

  return (
    <View style={appStyles.card}>
      <Text style={appStyles.sectionTitle}>{editingId ? "редактировать" : "add content"}</Text>
      <PillButton
        label={isImporting ? "тянем данные..." : "импорт"}
        onPress={onImportPress}
        disabled={isImporting}
      />
      <PillButton
        label={isScreenshotImporting ? "анализируем скрин..." : "загрузить скриншот"}
        onPress={onScreenshotImportPress}
        disabled={isScreenshotImporting}
      />
      <Text style={appStyles.metaText}>импортировано: {importedCount} треков</Text>
      {screenshotStatus ? <Text style={appStyles.metaText}>{screenshotStatus}</Text> : null}
      <Text style={appStyles.label}>spotify account</Text>
      <PillButton
        label={spotifyOAuthLoading ? "открываем spotify..." : spotifyConnected ? "переподключить spotify" : "подключить spotify"}
        onPress={onSpotifyConnectPress}
        disabled={spotifyOAuthLoading}
      />
      <View style={appStyles.row}>
        <PillButton label="обновить spotify" onPress={onSpotifyRefreshPress} />
        <PillButton
          label={spotifyPlaylistLoading ? "грузим плейлисты..." : "мои плейлисты"}
          onPress={onSpotifyLoadPlaylistsPress}
          disabled={spotifyPlaylistLoading}
        />
      </View>
      <View style={appStyles.row}>
        <PillButton label="liked songs" onPress={onSpotifyLikedSongsPress} />
        <PillButton label="recently played" onPress={onSpotifyRecentlyPlayedPress} />
      </View>
      <Text style={appStyles.metaText}>
        {spotifyConnected
          ? spotifyProfileName
            ? `spotify подключен: ${spotifyProfileName}`
            : "spotify подключен"
          : "spotify еще не подключен"}
      </Text>
      <Text style={appStyles.label}>spotify link</Text>
      <TextInput
        style={appStyles.input}
        placeholder="вставь spotify track, album или playlist link"
        value={spotifyUrl}
        onChangeText={onSpotifyUrlChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <PillButton label="импортировать из spotify" onPress={onSpotifyImportPress} />
      {spotifyStatus ? <Text style={appStyles.metaText}>{spotifyStatus}</Text> : null}
      {spotifyPlaylists.length > 0 ? (
        <View style={appStyles.stack}>
          {spotifyPlaylists.map((playlist) => (
            <View key={playlist.id} style={appStyles.tile}>
              <Text style={appStyles.itemTitle}>{playlist.name}</Text>
              <Text style={appStyles.metaText}>{playlist.trackCount} треков</Text>
              <PillButton
                label="импортировать плейлист"
                onPress={() => onSpotifyPlaylistImportPress(playlist.id, playlist.name)}
              />
            </View>
          ))}
        </View>
      ) : null}

      <Text style={appStyles.label}>тип</Text>
      <View style={appStyles.row}>
        {(["music", "book", "film"] as ContentType[]).map((value) => (
          <PillButton
            key={value}
            label={TYPE_LABEL[value]}
            active={type === value}
            onPress={() => onTypeChange(value)}
          />
        ))}
      </View>

      <Text style={appStyles.label}>источник</Text>
      <View style={appStyles.row}>
        {(["manual", "import_spotify"] as SourceType[]).map((value) => (
          <PillButton
            key={value}
            label={SOURCE_LABEL[value]}
            active={source === value}
            onPress={() => onSourceChange(value)}
          />
        ))}
      </View>

      <Text style={appStyles.label}>название</Text>
      <TextInput
        style={appStyles.input}
        placeholder={`например: ${currentPh.title}`}
        value={title}
        onChangeText={onTitleChange}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={appStyles.label}>автор / исполнитель</Text>
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
  );
}

import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { AddScreen } from "../screens/AddScreen";
import { appStyles } from "../styles/appStyles";
import type { getTheme } from "../styles/theme";
import type { useEveryYouApp } from "../hooks/useEveryYouApp";

export function EditItemModal({ app, theme, visible }: {
  app: ReturnType<typeof useEveryYouApp>;
  theme: ReturnType<typeof getTheme>;
  visible: boolean;
}) {
  return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={app.cancelEdit}>
          <View style={[appStyles.dayModalBackdrop, { backgroundColor: theme.overlay }]}>
            <View style={[appStyles.editModalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={appStyles.dayModalTopRow}>
                <View style={appStyles.dayModalHeading}>
                  <Text style={[appStyles.sectionTitle, { color: theme.text }]}>редактировать</Text>
                  <Text style={[appStyles.editSheetMeta, { color: theme.mutedText }]}>
                    поправь тип, название или автора и сохрани изменения
                  </Text>
                </View>
                <Pressable
                  style={[appStyles.modalClose, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                  onPress={app.cancelEdit}
                >
                  <Text style={[appStyles.modalCloseText, { color: theme.text }]}>×</Text>
                </Pressable>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={appStyles.editSheetContent}
              >
                <AddScreen
                  themeMode={app.themeMode}
                  editingId={app.editingId}
                  isScreenshotImporting={app.isScreenshotImporting}
                  importedCount={app.importedCount}
                  screenshotStatus={app.screenshotStatus}
                  screenshotDateInsight={app.screenshotDateInsight}
                  pendingImageItems={app.pendingImageItems}
                  selectedPendingImageItem={app.selectedPendingImageItem}
                  confirmingPendingImageImport={app.confirmingPendingImageImport}
                  spotifyUrl={app.spotifyUrl}
                  spotifyStatus={app.spotifyStatus}
                  spotifyDateInsight={app.spotifyDateInsight}
                  spotifyConnected={app.spotifyConnected}
                  spotifyProfileName={app.spotifyProfileName}
                  spotifyPlaylists={app.spotifyPlaylists}
                  spotifyOAuthLoading={app.spotifyOAuthLoading}
                  spotifyPlaylistLoading={app.spotifyPlaylistLoading}
                  lastfmUsername={app.lastfmUsername}
                  letterboxdProfile={app.letterboxdProfile}
                  connectedSources={app.connectedSources}
                  fileImportStatus={app.fileImportStatus}
                  fileImportDateInsight={app.fileImportDateInsight}
                  type={app.type}
                  title={app.title}
                  authorOrArtist={app.authorOrArtist}
                  placeholderIndex={app.phIdx}
                  canSave={app.canSave}
                  onScreenshotImportPress={app.importFromScreenshot}
                  onConfirmPendingImageImport={app.confirmPendingImageImport}
                  onCancelPendingImageImport={app.cancelPendingImageImport}
                  onRemovePendingImageItem={app.removePendingImageItem}
                  onSelectPendingImageItem={app.selectPendingImageItem}
                  onUpdatePendingImageItem={app.updatePendingImageItem}
                  onAssignPendingImageItem={app.assignPendingImageItemTime}
                  onSpotifyUrlChange={app.setSpotifyUrl}
                  onSpotifyImportPress={app.importSpotifyLink}
                  onSpotifyConnectPress={app.connectSpotifyAccount}
                  onSpotifyRefreshPress={app.refreshSpotifyConnection}
                  onSpotifyLoadPlaylistsPress={app.loadSpotifyPlaylists}
                  onSpotifyLikedSongsPress={app.importSpotifyLikedSongs}
                  onSpotifyRecentlyPlayedPress={app.importSpotifyRecentlyPlayed}
                  onSpotifyPlaylistImportPress={app.importSpotifyPlaylist}
                  onLastfmUsernameChange={app.setLastfmUsername}
                  onLetterboxdProfileChange={app.setLetterboxdProfile}
                  onLastfmProfileImportPress={() => void app.importProfileSource("lastfm")}
                  onLetterboxdProfileImportPress={() => void app.importProfileSource("letterboxd")}
                  onDisconnectProfilePress={app.disconnectProfileSource}
                  onDisconnectSpotifyPress={app.disconnectSpotifySource}
                  onPlatformFileImportPress={app.importPlatformFile}
                  onTypeChange={app.setType}
                  onSourceChange={app.setSource}
                  onTitleChange={app.setTitle}
                  onAuthorOrArtistChange={app.setAuthorOrArtist}
                  onSavePress={app.saveEdit}
                  onCancelPress={app.cancelEdit}
                  onDone={() => undefined}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
  );
}

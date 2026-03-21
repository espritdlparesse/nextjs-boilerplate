import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, Text } from "react-native";
import { type Tab } from "./shared/everyyou/domain";
import { PillButton } from "./components/PillButton";
import { useEveryYouApp } from "./hooks/useEveryYouApp";
import { AnalysisScreen } from "./screens/AnalysisScreen";
import { AddScreen } from "./screens/AddScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LibraryScreen } from "./screens/LibraryScreen";
import { appStyles } from "./styles/appStyles";

export default function App() {
  const app = useEveryYouApp();

  return (
    <SafeAreaView style={appStyles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={appStyles.container}>
        <Text style={appStyles.brand}>everyyou</Text>
        <Text style={appStyles.subtitle}>привет, {app.displayName.toLowerCase()}</Text>
        <Text style={appStyles.syncText}>
          sync: {app.syncStatus === "online" ? "online" : app.syncStatus === "syncing" ? "syncing" : "offline"} ·{" "}
          {app.syncMessage}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={appStyles.tabs}>
          {(["home", "add", "library", "analysis"] as Tab[]).map((value) => (
            <PillButton
              key={value}
              label={value}
              active={app.tab === value}
              onPress={() => app.setTab(value)}
            />
          ))}
        </ScrollView>

        {app.tab === "home" && <HomeScreen onAddPress={() => app.setTab("add")} />}

        {app.tab === "add" && (
          <AddScreen
            editingId={app.editingId}
            isImporting={app.isImporting}
            isScreenshotImporting={app.isScreenshotImporting}
            importedCount={app.importedCount}
            screenshotStatus={app.screenshotStatus}
            spotifyUrl={app.spotifyUrl}
            spotifyStatus={app.spotifyStatus}
            spotifyConnected={app.spotifyConnected}
            spotifyProfileName={app.spotifyProfileName}
            spotifyPlaylists={app.spotifyPlaylists}
            spotifyOAuthLoading={app.spotifyOAuthLoading}
            spotifyPlaylistLoading={app.spotifyPlaylistLoading}
            fileImportStatus={app.fileImportStatus}
            type={app.type}
            source={app.source}
            title={app.title}
            authorOrArtist={app.authorOrArtist}
            placeholderIndex={app.phIdx}
            canSave={app.canSave}
            onImportPress={app.runFakeImport}
            onScreenshotImportPress={app.importFromScreenshot}
            onSpotifyUrlChange={app.setSpotifyUrl}
            onSpotifyImportPress={app.importSpotifyLink}
            onSpotifyConnectPress={app.connectSpotifyAccount}
            onSpotifyRefreshPress={app.refreshSpotifyConnection}
            onSpotifyLoadPlaylistsPress={app.loadSpotifyPlaylists}
            onSpotifyLikedSongsPress={app.importSpotifyLikedSongs}
            onSpotifyRecentlyPlayedPress={app.importSpotifyRecentlyPlayed}
            onSpotifyPlaylistImportPress={app.importSpotifyPlaylist}
            onLivelibImportPress={app.importLivelibFile}
            onLetterboxdImportPress={app.importLetterboxdFile}
            onLastfmImportPress={app.importLastfmFile}
            onTypeChange={app.setType}
            onSourceChange={app.setSource}
            onTitleChange={app.setTitle}
            onAuthorOrArtistChange={app.setAuthorOrArtist}
            onSavePress={app.editingId ? app.saveEdit : app.addItem}
            onCancelPress={app.cancelEdit}
            onDone={() => app.setTab("library")}
          />
        )}

        {app.tab === "library" && (
          <LibraryScreen
            typeFilter={app.typeFilter}
            sourceFilter={app.sourceFilter}
            selectedItem={app.selectedItem}
            visibleLibrary={app.visibleLibrary}
            onTypeFilterChange={app.setTypeFilter}
            onSourceFilterChange={app.setSourceFilter}
            onSelectItem={app.setSelectedId}
            onEditItem={(id) => {
              app.startEdit(id);
              app.setTab("add");
            }}
            onDeleteItem={app.removeItem}
          />
        )}

        {app.tab === "analysis" && (
          <AnalysisScreen
            counters={app.counters}
            analysisRunning={app.analysisRunning}
            analysisResult={app.analysisResult}
            analysisHistory={app.analysisHistory}
            onRunPress={app.runFakeAnalysis}
            onOpenResult={app.openAnalysisResult}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

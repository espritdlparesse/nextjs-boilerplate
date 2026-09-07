import { AnalysisScreen } from "../screens/AnalysisScreen";
import { AddScreen } from "../screens/AddScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import type { useEveryYouApp } from "../hooks/useEveryYouApp";

export function TabScreens({ app }: { app: ReturnType<typeof useEveryYouApp> }) {
  return (
    <>
      {app.tab === "home" && (
        <HomeScreen
          themeMode={app.themeMode}
          hasCustomName={app.hasCustomName}
          nameDraft={app.nameDraft}
          namePlaceholder={app.namePlaceholder}
          onAddPress={() => app.setTab("add")}
          onOpenLibraryType={(type) => {
            app.setTypeFilter(type);
            app.setTab("library");
          }}
          onOpenVibeCheck={() => app.setTab("analysis")}
          onNameDraftChange={app.setNameDraft}
          onSaveNamePress={app.saveProfileName}
        />
      )}

      {app.tab === "add" && (
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
          onSavePress={app.editingId ? app.saveEdit : app.addItem}
          onCancelPress={app.cancelEdit}
          onDone={() => app.setTab("library")}
        />
      )}

      {app.tab === "analysis" && (
        <AnalysisScreen
          themeMode={app.themeMode}
          library={app.library}
          counters={app.counters}
          analysisRunning={app.analysisRunning}
          analysisRunningScope={app.analysisRunningScope}
          analysisResult={app.analysisResult}
          deepAnalysisRunning={app.deepAnalysisRunning}
          deepAnalysisAccess={app.deepAnalysisAccess}
          deepAnalysisUsesLeft={app.deepAnalysisUsesLeft}
          deepAnalysisTotalFreeUses={app.deepAnalysisTotalFreeUses}
          deepAnalysisResult={app.deepAnalysisResult}
          onRunPress={app.runFakeAnalysis}
          onRunDeepPress={app.runDeepAnalysis}
        />
      )}

      {app.tab === "profile" && (
        <ProfileScreen
          themeMode={app.themeMode}
          displayName={app.displayName}
          hasCustomName={app.hasCustomName}
          nameDraft={app.nameDraft}
          avatarUri={app.avatarUri}
          telegramLink={app.telegramLink}
          telegramLinkLoading={app.telegramLinkLoading}
          telegramLinkStatus={app.telegramLinkStatus}
          telegramLinkQrDataUrl={app.telegramLinkQrDataUrl}
          totalItems={app.counters.total}
          musicCount={app.counters.byType.music}
          bookCount={app.counters.byType.book}
          movieCount={app.counters.byType.movie}
          totalSteps={app.totalSteps}
          healthStepsEnabled={app.healthStepsEnabled}
          exactCount={app.timeStats.exact}
          importedCount={app.timeStats.imported}
          estimatedCount={app.timeStats.estimated}
          undatedCount={app.timeStats.undated}
          onNameDraftChange={app.setNameDraft}
          onSaveNamePress={app.saveProfileName}
          onPickAvatarPress={app.pickAvatar}
          onClearAvatarPress={app.clearAvatar}
          onThemeChange={app.setThemeMode}
          onHealthStepsEnabledChange={app.setHealthStepsEnabled}
          onCreateTelegramLinkCode={app.createTelegramLinkCode}
          onOpenTelegramLinkFlow={app.openTelegramLinkFlow}
          onReplayOnboarding={app.replayOnboarding}
        />
      )}
    </>
  );
}

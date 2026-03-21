import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { type Tab } from "./shared/everyyou/domain";
import { useEveryYouApp } from "./hooks/useEveryYouApp";
import { AnalysisScreen } from "./screens/AnalysisScreen";
import { AddScreen } from "./screens/AddScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LibraryScreen } from "./screens/LibraryScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { appStyles } from "./styles/appStyles";
import { getTheme } from "./styles/theme";

type NavItem = {
  key: Exclude<Tab, "add">;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { key: "home", label: "главная", icon: "◉" },
  { key: "library", label: "библиотека", icon: "▦" },
  { key: "analysis", label: "вайбчек", icon: "✦" },
  { key: "profile", label: "профиль", icon: "🌝" },
];

export default function App() {
  const app = useEveryYouApp();
  const theme = getTheme(app.themeMode);
  const toastOpacity = useSharedValue(0);
  const toastTranslateY = useSharedValue(18);
  const toastScale = useSharedValue(0.96);

  useEffect(() => {
    if (!app.toastMessage) {
      toastOpacity.value = withTiming(0, { duration: 170, easing: Easing.out(Easing.quad) });
      toastTranslateY.value = withTiming(18, { duration: 170, easing: Easing.out(Easing.quad) });
      toastScale.value = withTiming(0.96, { duration: 170, easing: Easing.out(Easing.quad) });
      return;
    }

    toastTranslateY.value = withSpring(0, {
      damping: 14,
      stiffness: 180,
      mass: 0.8,
    });
    toastScale.value = withSpring(1, {
      damping: 14,
      stiffness: 180,
      mass: 0.8,
    });
    toastOpacity.value = withTiming(1, { duration: 210, easing: Easing.out(Easing.quad) });
  }, [app.toastMessage, toastOpacity, toastScale, toastTranslateY]);

  const toastAnimatedStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ translateY: toastTranslateY.value }, { scale: toastScale.value }],
  }));

  const headerBlock = (
    <View style={appStyles.appHeader}>
      <View style={appStyles.headerIdentityRow}>
        {app.avatarUri ? (
          <Image source={{ uri: app.avatarUri }} style={appStyles.headerAvatarImage} />
        ) : (
          <View
            style={[
              appStyles.headerAvatarBubble,
              { backgroundColor: app.themeMode === "dark" ? theme.surfaceMuted : "#F4F4F4", borderColor: theme.border },
            ]}
          >
            <Text style={appStyles.headerAvatarEmoji}>{app.headerAvatarEmoji}</Text>
          </View>
        )}
        <View style={appStyles.headerIdentityText}>
          <Text style={[appStyles.brand, { color: theme.text }]}>everyyou</Text>
          {app.hasCustomName ? (
            <Text style={[appStyles.subtitle, { color: theme.text }]}>привет, {app.displayName.toLowerCase()}</Text>
          ) : null}
        </View>
      </View>
      <Text style={[appStyles.syncText, { color: theme.mutedText }]}>
        синхронизация: {app.syncStatus === "online" ? "онлайн" : app.syncStatus === "syncing" ? "обновляем" : "офлайн"} ·{" "}
        {app.syncMessage}
      </Text>
    </View>
  );

  return (
    <GestureHandlerRootView style={[appStyles.safeArea, { backgroundColor: theme.background }]}>
      <SafeAreaView style={[appStyles.safeArea, { backgroundColor: theme.background }]}>
        <StatusBar style={app.themeMode === "dark" ? "light" : "dark"} />
        <View style={[appStyles.shell, { backgroundColor: theme.background }]}>
          {app.tab === "library" ? (
            <View style={[appStyles.libraryShell, { backgroundColor: theme.background }]}>
              <View style={appStyles.libraryHeader}>{headerBlock}</View>
              <LibraryScreen
                themeMode={app.themeMode}
                typeFilter={app.typeFilter}
                sourceFilter={app.sourceFilter}
                timeQualityFilter={app.timeQualityFilter}
                undatedVisibleLibrary={app.undatedVisibleLibrary}
                timelineSpreading={app.timelineSpreading}
                timelinePromptVisible={app.timelinePromptVisible}
                selectedItem={app.selectedItem}
                visibleLibrary={app.visibleLibrary}
                onTypeFilterChange={app.setTypeFilter}
                onSourceFilterChange={app.setSourceFilter}
                onTimeQualityFilterChange={app.setTimeQualityFilter}
                onSelectItem={app.setSelectedId}
                onSpreadThisMonth={app.spreadIntoThisMonth}
                onSpreadLastMonth={app.spreadIntoLastMonth}
                onSpreadLast6Months={app.spreadIntoLast6Months}
                onSpreadThisYear={app.spreadIntoThisYear}
                onSpreadVeryOld={app.spreadIntoVeryOld}
                onAssignItemTime={app.assignItemTime}
                onAssignSelectedThisMonth={app.assignSelectedToThisMonth}
                onAssignSelectedLastMonth={app.assignSelectedToLastMonth}
                onAssignSelectedLast6Months={app.assignSelectedToLast6Months}
                onAssignSelectedThisYear={app.assignSelectedToThisYear}
                onAssignSelectedVeryOld={app.assignSelectedToVeryOld}
                onDismissTimelinePrompt={app.dismissTimelinePrompt}
                onEditItem={(id) => {
                  app.startEdit(id);
                  app.setTab("add");
                }}
                onDeleteItem={app.removeItem}
              />
            </View>
          ) : (
            <ScrollView
              style={[appStyles.scroll, { backgroundColor: theme.background }]}
              contentContainerStyle={[appStyles.container, { backgroundColor: theme.background }]}
            >
              {headerBlock}

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
                  onAssignPendingImageItemThisMonth={app.assignPendingImageItemThisMonth}
                  onAssignPendingImageItemLastMonth={app.assignPendingImageItemLastMonth}
                  onAssignPendingImageItemLast6Months={app.assignPendingImageItemLast6Months}
                  onAssignPendingImageItemThisYear={app.assignPendingImageItemThisYear}
                  onAssignPendingImageItemVeryOld={app.assignPendingImageItemVeryOld}
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
                  onKinopoiskImportPress={app.importKinopoiskFile}
                  onMubiImportPress={app.importMubiFile}
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
                  counters={app.counters}
                  analysisRunning={app.analysisRunning}
                  analysisResult={app.analysisResult}
                  analysisHistory={app.analysisHistory}
                  onRunPress={app.runFakeAnalysis}
                  onOpenResult={app.openAnalysisResult}
                />
              )}

              {app.tab === "profile" && (
                <ProfileScreen
                  themeMode={app.themeMode}
                  displayName={app.displayName}
                  nameDraft={app.nameDraft}
                  avatarUri={app.avatarUri}
                  totalItems={app.counters.total}
                  musicCount={app.counters.byType.music}
                  bookCount={app.counters.byType.book}
                  filmCount={app.counters.byType.film}
                  exactCount={app.timeStats.exact}
                  importedCount={app.timeStats.imported}
                  estimatedCount={app.timeStats.estimated}
                  undatedCount={app.timeStats.undated}
                  onNameDraftChange={app.setNameDraft}
                  onSaveNamePress={app.saveProfileName}
                  onPickAvatarPress={app.pickAvatar}
                  onClearAvatarPress={app.clearAvatar}
                  onThemeChange={app.setThemeMode}
                />
              )}
            </ScrollView>
          )}

          <View style={appStyles.bottomBarWrap}>
            {app.toastMessage ? (
              <Animated.View style={[appStyles.toast, toastAnimatedStyle, { backgroundColor: theme.toastBg }]}>
                <Text style={[appStyles.toastText, { color: theme.toastText }]}>{app.toastMessage}</Text>
              </Animated.View>
            ) : null}

            <View style={[appStyles.bottomBar, { backgroundColor: theme.bottomBarBg, borderColor: theme.bottomBarBorder }]}>
              {navItems.slice(0, 2).map((item) => {
                const active = app.tab === item.key;
                return (
                  <Pressable key={item.key} style={appStyles.bottomItem} onPress={() => app.setTab(item.key)}>
                    <View
                      style={[
                        appStyles.bottomIcon,
                        { backgroundColor: active ? theme.bottomIconActiveBg : theme.bottomIconBg },
                      ]}
                    >
                      <Text style={[appStyles.secondaryText, { color: theme.bottomIconText }]}>{item.icon}</Text>
                    </View>
                    <Text style={[appStyles.bottomItemLabel, { color: active ? theme.bottomLabelActive : theme.bottomLabel }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}

              <View style={appStyles.bottomPlusWrap}>
                <Pressable style={[appStyles.bottomPlus, { borderColor: theme.bottomPlusBorder }]} onPress={() => app.setTab("add")}>
                  <Text style={appStyles.bottomPlusText}>+</Text>
                </Pressable>
              </View>

              {navItems.slice(2).map((item) => {
                const active = app.tab === item.key;
                return (
                  <Pressable key={item.key} style={appStyles.bottomItem} onPress={() => app.setTab(item.key)}>
                    <View
                      style={[
                        appStyles.bottomIcon,
                        { backgroundColor: active ? theme.bottomIconActiveBg : theme.bottomIconBg },
                      ]}
                    >
                      <Text style={[appStyles.secondaryText, { color: theme.bottomIconText }]}>{item.icon}</Text>
                    </View>
                    <Text style={[appStyles.bottomItemLabel, { color: active ? theme.bottomLabelActive : theme.bottomLabel }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

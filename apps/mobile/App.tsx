import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { type Tab } from "./shared/everyyou/domain";
import { useEveryYouApp } from "./hooks/useEveryYouApp";
import { AnalysisScreen } from "./screens/AnalysisScreen";
import { AddScreen } from "./screens/AddScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LibraryScreen } from "./screens/LibraryScreen";
import { appStyles } from "./styles/appStyles";

type NavItem = {
  key: Exclude<Tab, "add">;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { key: "home", label: "главная", icon: "◉" },
  { key: "library", label: "библиотека", icon: "▦" },
  { key: "analysis", label: "вайбчек", icon: "✦" },
];

export default function App() {
  const app = useEveryYouApp();
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(18)).current;
  const toastScale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (!app.toastMessage) {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 170,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: 18,
          duration: 170,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(toastScale, {
          toValue: 0.96,
          duration: 170,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.spring(toastTranslateY, {
        toValue: 0,
        damping: 14,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.spring(toastScale, {
        toValue: 1,
        damping: 14,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 210,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [app.toastMessage, toastOpacity, toastScale, toastTranslateY]);

  return (
    <SafeAreaView style={appStyles.safeArea}>
      <StatusBar style="dark" />
      <View style={appStyles.shell}>
        <ScrollView style={appStyles.scroll} contentContainerStyle={appStyles.container}>
          <Text style={appStyles.brand}>everyyou</Text>
          {app.hasCustomName ? (
            <Text style={appStyles.subtitle}>привет, {app.displayName.toLowerCase()}</Text>
          ) : null}
          <Text style={appStyles.syncText}>
            синхронизация: {app.syncStatus === "online" ? "онлайн" : app.syncStatus === "syncing" ? "обновляем" : "офлайн"} ·{" "}
            {app.syncMessage}
          </Text>

          {app.tab === "home" && (
            <HomeScreen
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
              editingId={app.editingId}
              isScreenshotImporting={app.isScreenshotImporting}
              importedCount={app.importedCount}
              screenshotStatus={app.screenshotStatus}
              pendingImageItems={app.pendingImageItems}
              confirmingPendingImageImport={app.confirmingPendingImageImport}
              spotifyUrl={app.spotifyUrl}
              spotifyStatus={app.spotifyStatus}
              spotifyConnected={app.spotifyConnected}
              spotifyProfileName={app.spotifyProfileName}
              spotifyPlaylists={app.spotifyPlaylists}
              spotifyOAuthLoading={app.spotifyOAuthLoading}
              spotifyPlaylistLoading={app.spotifyPlaylistLoading}
              fileImportStatus={app.fileImportStatus}
              type={app.type}
              title={app.title}
              authorOrArtist={app.authorOrArtist}
              placeholderIndex={app.phIdx}
              canSave={app.canSave}
              onScreenshotImportPress={app.importFromScreenshot}
              onConfirmPendingImageImport={app.confirmPendingImageImport}
              onCancelPendingImageImport={app.cancelPendingImageImport}
              onRemovePendingImageItem={app.removePendingImageItem}
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

          {app.tab === "library" && (
            <LibraryScreen
              typeFilter={app.typeFilter}
              sourceFilter={app.sourceFilter}
              undatedVisibleLibrary={app.undatedVisibleLibrary}
              timelineSpreading={app.timelineSpreading}
              selectedItem={app.selectedItem}
              visibleLibrary={app.visibleLibrary}
              onTypeFilterChange={app.setTypeFilter}
              onSourceFilterChange={app.setSourceFilter}
              onSelectItem={app.setSelectedId}
              onSpreadThisMonth={app.spreadIntoThisMonth}
              onSpreadLastMonth={app.spreadIntoLastMonth}
              onSpreadLast3Months={app.spreadIntoLast3Months}
              onSpreadThisYear={app.spreadIntoThisYear}
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

        <View style={appStyles.bottomBarWrap}>
          {app.toastMessage ? (
            <Animated.View
              style={[
                appStyles.toast,
                {
                  opacity: toastOpacity,
                  transform: [{ translateY: toastTranslateY }, { scale: toastScale }],
                },
              ]}
            >
              <Text style={appStyles.toastText}>{app.toastMessage}</Text>
            </Animated.View>
          ) : null}

          <View style={appStyles.bottomBar}>
            {navItems.slice(0, 2).map((item) => {
              const active = app.tab === item.key;
              return (
                <Pressable key={item.key} style={appStyles.bottomItem} onPress={() => app.setTab(item.key)}>
                  <View style={[appStyles.bottomIcon, active && appStyles.bottomIconActive]}>
                    <Text style={appStyles.secondaryText}>{item.icon}</Text>
                  </View>
                  <Text style={[appStyles.bottomItemLabel, active && appStyles.bottomItemLabelActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}

            <View style={appStyles.bottomPlusWrap}>
              <Pressable style={appStyles.bottomPlus} onPress={() => app.setTab("add")}>
                <Text style={appStyles.bottomPlusText}>+</Text>
              </Pressable>
            </View>

            {navItems.slice(2).map((item) => {
              const active = app.tab === item.key;
              return (
                <Pressable key={item.key} style={appStyles.bottomItem} onPress={() => app.setTab(item.key)}>
                  <View style={[appStyles.bottomIcon, active && appStyles.bottomIconActive]}>
                    <Text style={appStyles.secondaryText}>{item.icon}</Text>
                  </View>
                  <Text style={[appStyles.bottomItemLabel, active && appStyles.bottomItemLabelActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

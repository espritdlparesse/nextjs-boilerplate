import "react-native-gesture-handler";
import * as MediaLibrary from "expo-media-library";
import * as ScreenCapture from "expo-screen-capture";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, SafeAreaView, ScrollView, Share, Text, View } from "react-native";
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
  const [screenshotPromptVisible, setScreenshotPromptVisible] = useState(false);
  const [latestScreenshotUri, setLatestScreenshotUri] = useState<string | null>(null);
  const [screenshotActionLoading, setScreenshotActionLoading] = useState(false);
  const [screenshotStatus, setScreenshotStatus] = useState<string | null>(null);
  const screenshotEventRef = useRef<number>(0);
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

  async function findLatestScreenshotUri() {
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error("разреши доступ к фото, чтобы поделиться скриншотом");
    }

    const result = await MediaLibrary.getAssetsAsync({
      first: 12,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [MediaLibrary.SortBy.creationTime],
    });

    if (!result.assets.length) {
      throw new Error("не нашли недавние изображения");
    }

    const screenshotAt = screenshotEventRef.current || Date.now();

    for (const asset of result.assets) {
      const createdAtMs = asset.creationTime ? asset.creationTime * 1000 : Date.now();
      const filename = `${asset.filename ?? ""}`.toLowerCase();
      const nearScreenshotMoment = Math.abs(createdAtMs - screenshotAt) < 3 * 60 * 1000;
      const looksLikeScreenshot =
        filename.includes("screenshot") ||
        filename.includes("screen shot") ||
        filename.includes("img_");

      if (!nearScreenshotMoment && !looksLikeScreenshot) continue;

      const info = await MediaLibrary.getAssetInfoAsync(asset);
      const localUri = info.localUri ?? info.uri ?? null;
      if (localUri) return localUri;
    }

    const fallbackInfo = await MediaLibrary.getAssetInfoAsync(result.assets[0]);
    return fallbackInfo.localUri ?? fallbackInfo.uri ?? null;
  }

  useEffect(() => {
    const subscription = ScreenCapture.addScreenshotListener(() => {
      screenshotEventRef.current = Date.now();
      setScreenshotPromptVisible(true);
      setScreenshotStatus(null);
      setLatestScreenshotUri(null);

      void findLatestScreenshotUri()
        .then((uri) => setLatestScreenshotUri(uri))
        .catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  async function shareLatestScreenshot() {
    try {
      setScreenshotActionLoading(true);
      setScreenshotStatus("готовим скриншот к отправке...");
      const screenshotUri = latestScreenshotUri ?? (await findLatestScreenshotUri());

      if (!screenshotUri) {
        throw new Error("не нашли скриншот для отправки");
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(screenshotUri);
      } else {
        await Share.share({
          message: "скриншот уже готов — можно отправить его в Telegram, Instagram или куда угодно еще",
        });
      }

      setScreenshotPromptVisible(false);
      setScreenshotStatus(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "не удалось подготовить скриншот к отправке";
      setScreenshotStatus(message);
    } finally {
      setScreenshotActionLoading(false);
    }
  }

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
          {screenshotPromptVisible ? (
            <View style={[appStyles.screenshotSheetWrap, { backgroundColor: theme.overlay }]}>
              <View
                style={[
                  appStyles.screenshotSheet,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={appStyles.screenshotSheetTop}>
                  <View style={appStyles.screenshotSheetHeading}>
                    <Text style={[appStyles.screenshotSheetTitle, { color: theme.text }]}>
                      скриншот готов
                    </Text>
                    <Text style={[appStyles.screenshotSheetText, { color: theme.mutedText }]}>
                      можно поделиться им или сразу отправить в everyyou
                    </Text>
                  </View>
                  <Pressable
                    style={[
                      appStyles.dayModalClose,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}
                    onPress={() => {
                      setScreenshotPromptVisible(false);
                      setScreenshotStatus(null);
                    }}
                  >
                    <Text style={[appStyles.dayModalCloseText, { color: theme.text }]}>не сейчас</Text>
                  </Pressable>
                </View>

                <View style={appStyles.row}>
                  <Pressable
                    style={[
                      appStyles.pillButton,
                      appStyles.primaryButton,
                      appStyles.screenshotActionButtonSingle,
                      screenshotActionLoading && appStyles.disabledButton,
                      { backgroundColor: theme.buttonPrimaryBg, borderColor: theme.buttonPrimaryBorder },
                    ]}
                    disabled={screenshotActionLoading}
                    onPress={shareLatestScreenshot}
                  >
                    <Text style={[appStyles.primaryText, { color: theme.buttonPrimaryText }]}>
                      {screenshotActionLoading ? "готовим..." : "поделиться"}
                    </Text>
                  </Pressable>
                </View>

                <Text style={[appStyles.screenshotSheetMeta, { color: theme.mutedText }]}>
                  можно отправить в Telegram, Instagram или куда угодно еще
                </Text>
                {screenshotStatus ? (
                  <Text style={[appStyles.screenshotSheetStatus, { color: theme.mutedText }]}>
                    {screenshotStatus}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {app.fileImportBusy ? (
            <View style={[appStyles.busyOverlay, { backgroundColor: theme.overlay }]}>
              <View
                style={[
                  appStyles.busyOverlayCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={[appStyles.busyOverlayTitle, { color: theme.text }]}>открываем файлы...</Text>
                <Text style={[appStyles.busyOverlayText, { color: theme.mutedText }]}>
                  это может занять несколько секунд
                </Text>
                {app.fileImportCanCancel ? (
                  <Pressable
                    style={[
                      appStyles.dayModalClose,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                    ]}
                    onPress={app.cancelFileImportOpening}
                  >
                    <Text style={[appStyles.dayModalCloseText, { color: theme.text }]}>закрыть</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

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
                  lastfmUsername={app.lastfmUsername}
                  letterboxdProfile={app.letterboxdProfile}
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
                  onLastfmUsernameChange={app.setLastfmUsername}
                  onLetterboxdProfileChange={app.setLetterboxdProfile}
                  onLastfmProfileImportPress={app.importLastfmProfileByUsername}
                  onLetterboxdProfileImportPress={app.importLetterboxdPublicProfile}
                  onLivelibImportPress={app.importLivelibFile}
                  onGoodreadsImportPress={app.importGoodreadsFile}
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
                  nameDraft={app.nameDraft}
                  avatarUri={app.avatarUri}
                  telegramLink={app.telegramLink}
                  telegramLinkLoading={app.telegramLinkLoading}
                  telegramLinkStatus={app.telegramLinkStatus}
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
                  onCreateTelegramLinkCode={app.createTelegramLinkCode}
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
                    <Text
                      style={[appStyles.bottomItemLabel, { color: active ? theme.bottomLabelActive : theme.bottomLabel }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
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
                    <Text
                      style={[appStyles.bottomItemLabel, { color: active ? theme.bottomLabelActive : theme.bottomLabel }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
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

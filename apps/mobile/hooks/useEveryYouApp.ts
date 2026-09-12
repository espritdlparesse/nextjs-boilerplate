import { useTimeline } from "./useTimeline";
import { useOnboarding } from "./useOnboarding";
import { useIncomingShare } from "./useIncomingShare";
import { useProfileSettings } from "./useProfileSettings";
import { useLibraryView } from "./useLibraryView";
import { useDailySteps } from "./useDailySteps";
import { filterApi, spotifyApi, timelineApi } from "./appApi";
import { useToast } from "./useToast";
import { useAppAnalytics } from "./useAppAnalytics";
import { applyBootstrapState, fetchRemoteAppState, readStoredAppState, refreshLinkedLibrary } from "./bootstrap";
import { useTelegramLink } from "./useTelegramLink";
import { useAnalysis } from "./useAnalysis";
import { useItemEditor } from "./useItemEditor";
import { hasValidCustomName } from "./appStorage";
import type { SyncStatus } from "./appTypes";
import { useLibraryImports } from "./useLibraryImports";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  getDisplayName,
  STORAGE_KEY_LIBRARY,
  type LibraryItem,
  type Tab,
  type TgUser,
} from "../shared/everyyou/domain";
import {
  fetchDeepVibeCheckAccess,
  getOrCreateDeviceId,
} from "../lib/api";
import { avatarEmojiFor } from "../../../lib/avatarEmojis";

const NAME_PLACEHOLDERS = [
  "лил пип",
  "владислав юрьевич",
  "настя д.",
  "имя фамилия",
  "случайный набор букв",
];

export function useEveryYouApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [user, setUser] = useState<TgUser | null>({ first_name: "ios", last_name: "друг" });
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const onboarding = useOnboarding(library);
  const view = useLibraryView(library, selectedId);
  const [phIdx, setPhIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState("локальная библиотека");
  const { toastMessage, setToastMessage } = useToast();
  const steps = useDailySteps({ loaded, setToastMessage });
  const displayName = useMemo(() => getDisplayName(user), [user]);
  const hasCustomName = useMemo(() => hasValidCustomName(user), [user]);
  const namePlaceholder = useMemo(
    () => NAME_PLACEHOLDERS[phIdx % NAME_PLACEHOLDERS.length],
    [phIdx]
  );

  const profile = useProfileSettings({
    apiToken, setUser, setToastMessage,
    fireAnalytics: (event, properties) => fireAnalytics(event, properties),
  });
  const fireAnalytics = useAppAnalytics({
    apiToken,
    loaded,
    tab,
    session: {
      themeMode: profile.themeMode,
      hasCustomName,
      hasAvatar: Boolean(profile.avatarUri),
      librarySize: library.length,
    },
  });

  const telegram = useTelegramLink({
    apiToken,
    fireAnalytics: (event, properties) => fireAnalytics(event, properties),
    setToastMessage,
    onJustLinked: async () => {
      if (!apiToken) return;
      await refreshLinkedLibrary(apiToken, { setLibrary, setSyncStatus, setSyncMessage });
      await imports.refreshSpotifyStatus(apiToken);
    },
  });

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const stored = await readStoredAppState();
      const storedDeviceId = await getOrCreateDeviceId();
      if (mounted) setDeviceId(storedDeviceId);
      if (mounted) {
        setSyncStatus("syncing");
        setSyncMessage("подключаем backend...");
      }
      const remote = await fetchRemoteAppState(stored, telegram.telegramLinkWasLinkedRef.current);
      if (!mounted) return;
      applyBootstrapState(stored, remote, {
        setLibrary,
        setImportedCount: imports.setImportedCount,
        setAnalysisHistory: analysis.setAnalysisHistory,
        setUser,
        setNameDraft: profile.setNameDraft,
        setAvatarUri: profile.setAvatarUri,
        setThemeMode: profile.setThemeMode,
        setDailySteps: steps.setDailySteps,
        setHealthStepsEnabled: steps.setHealthStepsEnabled,
        setApiToken,
        setSyncStatus,
        setSyncMessage,
        setConnectedSources: imports.setConnectedSources,
        setLastfmUsername: imports.setLastfmUsername,
        setLetterboxdProfile: imports.setLetterboxdProfile,
        setTelegramLink: telegram.setTelegramLink,
        telegramLinkWasLinkedRef: telegram.telegramLinkWasLinkedRef,
        onboarding,
        setLoaded,
      });
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setPhIdx((current) => current + 1), 2500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!apiToken) return;
    fetchDeepVibeCheckAccess(apiToken)
      .then((data) => {
        analysis.setDeepAnalysisAccess(data.access);
        analysis.setDeepAnalysisUsesLeft(data.usesLeft);
        analysis.setDeepAnalysisTotalFreeUses(data.totalFreeUses);
      })
      .catch(() => undefined);
  }, [apiToken]);

  useEffect(() => {
    if (!loaded) return;
    if (syncStatus === "online" && library.length === 0) return;
    AsyncStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(library)).catch(() => undefined);
  }, [library, loaded, syncStatus]);

  const analysis = useAnalysis({ apiToken, counters: view.counters, fireAnalytics, setToastMessage, loaded });

  const timeline = useTimeline({ apiToken, library, setLibrary, setSyncStatus, setSyncMessage, setToastMessage, setTab, undatedVisibleLibrary: view.undatedVisibleLibrary });
  const imports = useLibraryImports({ apiToken, setLibrary, setSelectedId, setSyncStatus, setSyncMessage, setToastMessage, setTab, timeline, loaded, fireAnalytics });
  const editor = useItemEditor({ apiToken, library, setLibrary, setSyncStatus, setSyncMessage, setToastMessage, setTab, fireAnalytics, clearSpotifyUrl: () => imports.setSpotifyUrl(""), selectedId, setSelectedId });

  useIncomingShare({
    loaded,
    onSpotifyUrl: (url) => {
      imports.setSpotifyUrl(url);
      imports.setSpotifyStatus("получили ссылку из share, можно импортировать");
      setTab("add");
      setToastMessage("ссылка открыта в everyyou");
    },
    onSharedItem: (item) => {
      editor.setType(item.type);
      editor.setSource("manual");
      editor.setTitle(item.title);
      editor.setAuthorOrArtist(item.authorOrArtist);
      setTab("add");
      setToastMessage("контент из share открыт");
    },
  });

  const selectedPendingImageItem = useMemo(
    () => imports.pendingImageItems.find((item) => item.id === imports.selectedPendingImageId) ?? null,
    [imports.pendingImageItems, imports.selectedPendingImageId]
  );

  return {
    tab,
    setTab,
    displayName,
    hasCustomName,
    nameDraft: profile.nameDraft,
    avatarUri: profile.avatarUri,
    headerAvatarEmoji: avatarEmojiFor(telegram.telegramLink.telegramOwnerKey ?? deviceId),
    themeMode: profile.themeMode,
    telegramLink: telegram.telegramLink,
    telegramLinkLoading: telegram.telegramLinkLoading,
    telegramLinkStatus: telegram.telegramLinkStatus,
    telegramLinkQrDataUrl: telegram.telegramLinkQrDataUrl,
    namePlaceholder,
    syncStatus,
    syncMessage,
    toastMessage,
    editingId: editor.editingId,
    isImporting: imports.isImporting,
    isScreenshotImporting: imports.isScreenshotImporting,
    importedCount: imports.importedCount,
    screenshotStatus: imports.screenshotStatus,
    screenshotDateInsight: imports.screenshotDateInsight,
    pendingImageItems: imports.pendingImageItems,
    selectedPendingImageItem,
    confirmingPendingImageImport: imports.confirmingPendingImageImport,
    spotifyUrl: imports.spotifyUrl,
    spotifyStatus: imports.spotifyStatus,
    spotifyDateInsight: imports.spotifyDateInsight,
    spotifyConnected: imports.spotifyConnected,
    spotifyProfileName: imports.spotifyProfileName,
    spotifyPlaylists: imports.spotifyPlaylists,
    spotifyOAuthLoading: imports.spotifyOAuthLoading,
    spotifyPlaylistLoading: imports.spotifyPlaylistLoading,
    lastfmUsername: imports.lastfmUsername,
    letterboxdProfile: imports.letterboxdProfile,
    connectedSources: imports.connectedSources,
    fileImportStatus: imports.fileImportStatus,
    fileImportBusy: imports.fileImportBusy,
    fileImportCanCancel: imports.fileImportCanCancel,
    fileImportDateInsight: imports.fileImportDateInsight,
    type: editor.type,
    source: editor.source,
    title: editor.title,
    authorOrArtist: editor.authorOrArtist,
    phIdx,
    canSave: editor.canSave,
    typeFilter: view.typeFilter,
    sourceFilter: view.sourceFilter,
    timeQualityFilter: view.timeQualityFilter,
    undatedVisibleLibrary: view.undatedVisibleLibrary,
    selectedItem: view.selectedItem,
    library,
    visibleLibrary: view.visibleLibrary,
    counters: view.counters,
    timeStats: view.timeStats,
    dailyStepsByDay: steps.dailyStepsByDay,
    totalSteps: steps.totalSteps,
    healthStepsEnabled: steps.healthStepsEnabled,
    analysisRunning: analysis.analysisRunning,
    analysisRunningScope: analysis.analysisRunningScope,
    analysisResult: analysis.analysisResult,
    analysisHistory: analysis.analysisHistory,
    deepAnalysisRunning: analysis.deepAnalysisRunning,
    deepAnalysisResult: analysis.deepAnalysisResult,
    deepAnalysisAccess: analysis.deepAnalysisAccess,
    deepAnalysisUsesLeft: analysis.deepAnalysisUsesLeft,
    deepAnalysisTotalFreeUses: analysis.deepAnalysisTotalFreeUses,
    timelineSpreading: timeline.timelineSpreading,
    timelinePromptVisible: timeline.timelinePromptVisible,
    setNameDraft: profile.setNameDraft,
    saveProfileName: profile.saveProfileName,
    pickAvatar: profile.pickAvatar,
    clearAvatar: profile.clearAvatar,
    setThemeMode: profile.updateThemeMode,
    setHealthStepsEnabled: steps.updateHealthStepsEnabled,
    createTelegramLinkCode: telegram.createTelegramLinkCode,
    openTelegramLinkFlow: telegram.openTelegramLinkFlow,
    setType: editor.setType,
    setSource: editor.setSource,
    setTitle: editor.setTitle,
    setAuthorOrArtist: editor.setAuthorOrArtist,
    addItem: editor.addItem,
    saveEdit: editor.saveEdit,
    startEdit: editor.startEdit,
    removeItem: editor.removeItem,
    runFakeImport: imports.runFakeImport,
    importFromScreenshot: imports.importFromScreenshot,
    confirmPendingImageImport: imports.confirmPendingImageImport,
    cancelPendingImageImport: imports.cancelPendingImageImport,
    removePendingImageItem: imports.removePendingImageItem,
    selectPendingImageItem: imports.setSelectedPendingImageId,
    updatePendingImageItem: imports.updatePendingImageItem,
    assignPendingImageItemTime: imports.assignPendingImageItemTime,
    setSpotifyUrl: imports.setSpotifyUrl,
    importSpotifyLink: imports.importSpotifyLink,
    connectSpotifyAccount: imports.connectSpotifyAccount,
    ...spotifyApi(imports),
    setLastfmUsername: imports.setLastfmUsername,
    setLetterboxdProfile: imports.setLetterboxdProfile,
    importProfileSource: imports.importProfileSource,
    disconnectProfileSource: imports.disconnectProfileSource,
    disconnectSpotifySource: imports.disconnectSpotifySource,
    importPlatformFile: imports.importPlatformFile,
    cancelFileImportOpening: imports.cancelFileImportOpening,
    ...filterApi(view, editor, setTab, setSelectedId),
    setSelectedId: setSelectedId,
    runFakeAnalysis: analysis.runFakeAnalysis,
    runDeepAnalysis: analysis.runDeepAnalysis,
    ...timelineApi(timeline, selectedId),
    promptTimelinePlacement: timeline.promptTimelinePlacement,
    openAnalysisResult: analysis.setAnalysisResult,
    showOnboarding: onboarding.showOnboarding,
    onboardingStep: onboarding.onboardingStep,
    onboardingVariant: onboarding.onboardingVariant,
    nextOnboardingStep: onboarding.nextOnboardingStep,
    skipOnboarding: onboarding.skipOnboarding,
    finishOnboarding: onboarding.finishOnboarding,
    replayOnboarding: onboarding.replayOnboarding,
  };
}

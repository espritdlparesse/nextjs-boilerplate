import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Linking } from "react-native";
import QRCode from "qrcode";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  clampText,
  getConsumptionDate,
  getDisplayName,
  LEGACY_ANALYSIS_KEYS,
  LEGACY_IMPORT_KEYS,
  LEGACY_LIBRARY_KEYS,
  normalizeLibrary,
  STORAGE_KEY_ANALYSIS,
  STORAGE_KEY_DAILY_STEPS,
  STORAGE_KEY_HEALTH_STEPS_ENABLED,
  STORAGE_KEY_IMPORT,
  STORAGE_KEY_LIBRARY,
  uid,
  type AnalysisRun,
  type ContentType,
  type DailyStepEntry,
  type LibraryItem,
  type SourceType,
  type ThemeMode,
  type TimeOrigin,
  type Tab,
  type TgUser,
} from "../shared/everyyou/domain";
import {
  analyzeScreenshot,
  clearStoredAvatarUri,
  createItem,
  deleteItem,
  disconnectConnectedSource,
  disconnectSpotifyConnection,
  ensureGuestSession,
  fetchBackendHealth,
  fetchConnectedSources,
  fetchCulturalMemoryConsent,
  fetchDeepVibeCheckAccess,
  fetchItems,
  fetchSpotifyConnectionStatus,
  fetchSpotifyPlaylists,
  fetchSharedProfile,
  fetchTelegramLinkStatus,
  getStoredOnboardingDone,
  getStoredAvatarUri,
  getStoredGuestName,
  getStoredThemeMode,
  getSpotifyOAuthUrl,
  importFromLastfmProfile,
  importFromLetterboxdProfile,
  importFromSpotifyUser,
  importFromSpotifyUrl,
  runDeepVibeCheck,
  runVibeCheck,
  updateCulturalMemoryConsent,
  resetGuestSession,
  saveConnectedSource,
  startTelegramLink,
  setStoredAvatarUri,
  setStoredGuestName,
  setStoredOnboardingDone,
  setStoredThemeMode,
  saveSharedProfile,
  trackAnalyticsEvent,
  uploadSharedProfileAvatar,
  updateItem,
} from "../lib/api";
import { parseImportedFile } from "../lib/fileImports";

type TypeFilter = ContentType | "all";
type SourceFilter = SourceType | "all";
type TimeQualityFilter = "all" | TimeOrigin | "undated";
type SyncStatus = "idle" | "syncing" | "online" | "offline";
type TimelineSpreadPreset = "this_month" | "last_month" | "last_6_months" | "this_year" | "very_old";
type SpotifyPlaylist = {
  id: string;
  name: string;
  trackCount: number;
};
type PendingImageItem = Pick<
  LibraryItem,
  "id" | "type" | "source" | "title" | "authorOrArtist" | "createdAt" | "consumedAt" | "timeOrigin"
>;
type DateInsight = {
  title: string;
  body: string;
  meta?: string;
};

type ConnectedSourceState = {
  lastfm: { profile: string; lastSyncedAt: string | null } | null;
  letterboxd: { profile: string; lastSyncedAt: string | null } | null;
};

type TelegramLinkState = {
  linked: boolean;
  telegramOwnerKey: string | null;
  code: string | null;
  expiresAt: string | null;
};

const NAME_PLACEHOLDERS = [
  "лил пип",
  "владислав юрьевич",
  "настя д.",
  "имя фамилия",
  "случайный набор букв",
];
const HEADER_AVATAR_EMOJIS = ["🐸", "😈", "👹", "👀", "🫀", "🐽", "🐣", "🦆", "🐳", "🦦"];

function isGuestSessionError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("bad signature") ||
    normalized.includes("missing auth") ||
    normalized.includes("expired") ||
    normalized.includes("invalid token") ||
    normalized.includes("401")
  );
}

function splitDisplayName(name: string): TgUser {
  const normalized = clampText(name);
  if (!normalized) {
    return { first_name: "друг", last_name: "" };
  }

  const [firstName, ...rest] = normalized.split(" ");
  return {
    first_name: firstName,
    last_name: rest.join(" "),
  };
}

async function loadJSON<T>(mainKey: string, legacyKeys: string[], fallback: T): Promise<T> {
  const mainRaw = await AsyncStorage.getItem(mainKey);
  if (mainRaw) {
    try {
      return JSON.parse(mainRaw) as T;
    } catch {
      return fallback;
    }
  }

  for (const legacyKey of legacyKeys) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (!legacyRaw) continue;
    try {
      const parsed = JSON.parse(legacyRaw) as T;
      await AsyncStorage.setItem(mainKey, JSON.stringify(parsed));
      return parsed;
    } catch {
      return fallback;
    }
  }

  return fallback;
}

async function loadNumber(mainKey: string, legacyKeys: string[]) {
  const mainRaw = await AsyncStorage.getItem(mainKey);
  if (mainRaw != null) {
    const n = Number(mainRaw);
    return Number.isFinite(n) ? n : 0;
  }

  for (const legacyKey of legacyKeys) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw == null) continue;
    const n = Number(legacyRaw);
    if (Number.isFinite(n)) {
      await AsyncStorage.setItem(mainKey, String(n));
      return n;
    }
  }

  return 0;
}

export function useEveryYouApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [user, setUser] = useState<TgUser | null>({ first_name: "ios", last_name: "друг" });
  const [type, setType] = useState<ContentType | "">("");
  const [source, setSource] = useState<SourceType | "">("");
  const [title, setTitle] = useState("");
  const [authorOrArtist, setAuthorOrArtist] = useState("");
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [timeQualityFilter, setTimeQualityFilter] = useState<TimeQualityFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [phIdx, setPhIdx] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isScreenshotImporting, setIsScreenshotImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [screenshotStatus, setScreenshotStatus] = useState<string | null>(null);
  const [pendingImageItems, setPendingImageItems] = useState<PendingImageItem[]>([]);
  const [selectedPendingImageId, setSelectedPendingImageId] = useState<string | null>(null);
  const [confirmingPendingImageImport, setConfirmingPendingImageImport] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyStatus, setSpotifyStatus] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyProfileName, setSpotifyProfileName] = useState<string | null>(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [spotifyOAuthLoading, setSpotifyOAuthLoading] = useState(false);
  const [spotifyPlaylistLoading, setSpotifyPlaylistLoading] = useState(false);
  const [lastfmUsername, setLastfmUsername] = useState("");
  const [letterboxdProfile, setLetterboxdProfile] = useState("");
  const [connectedSources, setConnectedSources] = useState<ConnectedSourceState>({
    lastfm: null,
    letterboxd: null,
  });
  const [fileImportStatus, setFileImportStatus] = useState<string | null>(null);
  const [fileImportBusy, setFileImportBusy] = useState(false);
  const [fileImportCanCancel, setFileImportCanCancel] = useState(false);
  const filePickerBusyRef = useRef(false);
  const filePickerCancelledRef = useRef(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisRunningScope, setAnalysisRunningScope] = useState<"full" | "range" | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisRun[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisRun | null>(null);
  const [deepAnalysisRunning, setDeepAnalysisRunning] = useState(false);
  const [deepAnalysisResult, setDeepAnalysisResult] = useState<AnalysisRun | null>(null);
  const [deepAnalysisAccess, setDeepAnalysisAccess] = useState<"free" | "paywall">("free");
  const [deepAnalysisUsesLeft, setDeepAnalysisUsesLeft] = useState<number>(2);
  const [deepAnalysisTotalFreeUses, setDeepAnalysisTotalFreeUses] = useState<number>(2);
  const [loaded, setLoaded] = useState(false);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState("локальная библиотека");
  const [nameDraft, setNameDraft] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [headerAvatarEmojiIndex, setHeaderAvatarEmojiIndex] = useState(() =>
    Math.floor(Math.random() * HEADER_AVATAR_EMOJIS.length)
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [telegramLink, setTelegramLink] = useState<TelegramLinkState>({
    linked: false,
    telegramOwnerKey: null,
    code: null,
    expiresAt: null,
  });
  const [telegramLinkLoading, setTelegramLinkLoading] = useState(false);
  const [telegramLinkStatus, setTelegramLinkStatus] = useState<string | null>(null);
  const [telegramLinkQrDataUrl, setTelegramLinkQrDataUrl] = useState<string | null>(null);
  const telegramLinkWasLinkedRef = useRef(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingVariant, setOnboardingVariant] = useState<"fresh" | "linked">("fresh");
  const [timelineSpreading, setTimelineSpreading] = useState(false);
  const [timelinePromptVisible, setTimelinePromptVisible] = useState(false);
  const [screenshotDateInsight, setScreenshotDateInsight] = useState<DateInsight | null>(null);
  const [spotifyDateInsight, setSpotifyDateInsight] = useState<DateInsight | null>(null);
  const [fileImportDateInsight, setFileImportDateInsight] = useState<DateInsight | null>(null);
  const [dailySteps, setDailySteps] = useState<DailyStepEntry[]>([]);
  const [healthStepsEnabled, setHealthStepsEnabled] = useState(false);
  const [culturalMemoryConsent, setCulturalMemoryConsent] = useState(false);
  const deferredLibrary = useDeferredValue(library);

  async function refreshLinkedLibrary(token: string, attempts = 4) {
    let lastRemoteLibrary: LibraryItem[] = [];

    for (let index = 0; index < attempts; index += 1) {
      try {
        const remoteLibrary = await fetchItems(token);
        lastRemoteLibrary = remoteLibrary;
        if (remoteLibrary.length > 0 || index === attempts - 1) {
          setLibrary((current) => (remoteLibrary.length === 0 && current.length > 0 ? current : remoteLibrary));
          setSyncStatus("online");
          setSyncMessage(
            remoteLibrary.length === 0 ? "пока показываем сохраненную библиотеку" : "данные синхронизируются с сервером"
          );
          return remoteLibrary;
        }
      } catch {
        // retry below
      }

      await new Promise((resolve) => setTimeout(resolve, 1200 * (index + 1)));
    }

    return lastRemoteLibrary;
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const storedLibrary = normalizeLibrary(
        await loadJSON<unknown[]>(STORAGE_KEY_LIBRARY, LEGACY_LIBRARY_KEYS, [])
      );
      const storedImportCount = await loadNumber(STORAGE_KEY_IMPORT, LEGACY_IMPORT_KEYS);
      const storedAnalysis = await loadJSON<AnalysisRun[]>(
        STORAGE_KEY_ANALYSIS,
        LEGACY_ANALYSIS_KEYS,
        []
      );

      let nextLibrary = storedLibrary;
      let nextUser: TgUser | null = { first_name: "ios", last_name: "друг" };
      let nextToken: string | null = null;
      let nextSyncStatus: SyncStatus = "offline";
      let nextSyncMessage = "локальная библиотека";
      const storedGuestName = await getStoredGuestName("ios friend");
      const storedAvatarUri = await getStoredAvatarUri();
      const storedThemeMode = await getStoredThemeMode();
      let nextAvatarUri = storedAvatarUri;
      let nextThemeMode = storedThemeMode;
      const onboardingDone = await getStoredOnboardingDone();
      const storedDailySteps = await loadJSON<DailyStepEntry[]>(STORAGE_KEY_DAILY_STEPS, [], []);
      const storedHealthStepsEnabled = (await AsyncStorage.getItem(STORAGE_KEY_HEALTH_STEPS_ENABLED)) === "true";

      try {
        if (mounted) {
          setSyncStatus("syncing");
          setSyncMessage("подключаем backend...");
        }

        const health = await fetchBackendHealth();
        if (!health.env.everyyouAppAuthSecret) {
          throw new Error("backend reachable, but EVERYYOU_APP_AUTH_SECRET is missing");
        }

        let session = await ensureGuestSession(storedGuestName);
        let remoteLibrary: LibraryItem[];
        let linkStatus: TelegramLinkState | null = null;
        try {
          remoteLibrary = await fetchItems(session.token);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (!isGuestSessionError(message)) {
            throw error;
          }

          await resetGuestSession();
          session = await ensureGuestSession(storedGuestName);
          remoteLibrary = await fetchItems(session.token);
        }
        try {
          linkStatus = await fetchTelegramLinkStatus(session.token);
        } catch {
          linkStatus = null;
        }
        try {
          const sources = await fetchConnectedSources(session.token);
          const nextSources: ConnectedSourceState = { lastfm: null, letterboxd: null };
          for (const source of sources.sources) {
            if (source.platform === "lastfm") {
              nextSources.lastfm = {
                profile: source.profile,
                lastSyncedAt: source.lastSyncedAt,
              };
            }
            if (source.platform === "letterboxd") {
              nextSources.letterboxd = {
                profile: source.profile,
                lastSyncedAt: source.lastSyncedAt,
              };
            }
          }
          setConnectedSources(nextSources);
          if (nextSources.lastfm?.profile) {
            setLastfmUsername(nextSources.lastfm.profile);
          }
          if (nextSources.letterboxd?.profile) {
            setLetterboxdProfile(nextSources.letterboxd.profile);
          }
        } catch {
          // ignore if migration is not applied yet or backend is temporarily unavailable
        }
        if (remoteLibrary.length === 0 && storedLibrary.length > 0) {
          nextLibrary = storedLibrary;
          nextSyncStatus = "online";
          nextSyncMessage = "пока показываем сохраненную библиотеку";
        } else {
          nextLibrary = remoteLibrary;
        }
        nextToken = session.token;
        nextUser = splitDisplayName(session.name ?? storedGuestName);
        try {
          const profile = await fetchSharedProfile(session.token);
          if (profile.displayName) nextUser = splitDisplayName(profile.displayName);
          if (profile.avatarUrl) nextAvatarUri = profile.avatarUrl;
          nextThemeMode = profile.themeMode;
        } catch {
          // Local settings remain the fallback before the profile migration reaches every environment.
        }
        if (linkStatus) {
          setTelegramLink(linkStatus);
          telegramLinkWasLinkedRef.current = linkStatus.linked;
        }
        if (
          remoteLibrary.length === 0 &&
          storedLibrary.length === 0 &&
          linkStatus &&
          !linkStatus.linked &&
          telegramLinkWasLinkedRef.current
        ) {
          nextSyncStatus = "online";
          nextSyncMessage = "похоже, нужно заново связать телеграм и айфон";
        }
        if (nextSyncStatus !== "online") {
          nextSyncStatus = "online";
          nextSyncMessage = "данные синхронизируются с сервером";
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "backend недоступен";
        nextSyncStatus = "offline";
        nextSyncMessage = message;
        nextUser = splitDisplayName(storedGuestName);
      }

      if (!mounted) return;
      setLibrary(nextLibrary);
      setImportedCount(storedImportCount);
      setAnalysisHistory(storedAnalysis);
      setUser(nextUser);
      setNameDraft(hasValidCustomName(nextUser) ? getDisplayName(nextUser) : "");
      setAvatarUri(nextAvatarUri);
      setThemeMode(nextThemeMode);
      setDailySteps(storedDailySteps);
      setHealthStepsEnabled(storedHealthStepsEnabled);
      setApiToken(nextToken);
      setSyncStatus(nextSyncStatus);
      setSyncMessage(nextSyncMessage);
      if (!onboardingDone) {
        setOnboardingVariant(nextLibrary.length > 0 ? "linked" : "fresh");
        setShowOnboarding(true);
        setOnboardingStep(0);
      }
      setLoaded(true);
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

  function fireAnalytics(event: string, properties?: Record<string, unknown>) {
    if (!apiToken) return;
    trackAnalyticsEvent(apiToken, event, properties).catch(() => undefined);
  }

  useEffect(() => {
    if (!loaded || !apiToken) return;
    fireAnalytics("app_open", {
      themeMode,
      hasCustomName,
      hasAvatar: Boolean(avatarUri),
      librarySize: library.length,
    });
  }, [loaded, apiToken]);

  useEffect(() => {
    if (!loaded || !apiToken) return;
    fireAnalytics("screen_view", { screen: tab });
  }, [tab, loaded, apiToken]);

  useEffect(() => {
    if (!apiToken) return;

    fetchCulturalMemoryConsent(apiToken).then((data) => setCulturalMemoryConsent(data.enabled)).catch(() => undefined);
  }, [apiToken]);

  async function setCulturalMemoryConsentEnabled(enabled: boolean) {
    if (!apiToken) {
      setToastMessage("сначала подключимся к серверу");
      return;
    }
    try {
      const data = await updateCulturalMemoryConsent(apiToken, enabled);
      setCulturalMemoryConsent(data.enabled);
      setToastMessage(data.enabled ? "помогаешь культурной памяти" : "участие выключено");
    } catch {
      setToastMessage("не получилось сохранить настройку");
    }
  }

  useEffect(() => {
    if (!apiToken) return;
    fetchDeepVibeCheckAccess(apiToken)
      .then((data) => {
        setDeepAnalysisAccess(data.access);
        setDeepAnalysisUsesLeft(data.usesLeft);
        setDeepAnalysisTotalFreeUses(data.totalFreeUses);
      })
      .catch(() => undefined);
  }, [apiToken]);

  useEffect(() => {
    if (!apiToken) return;
    let cancelled = false;

    fetchTelegramLinkStatus(apiToken)
      .then((status) => {
        if (cancelled) return;
        setTelegramLink(status);
        telegramLinkWasLinkedRef.current = status.linked;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [apiToken]);

  useEffect(() => {
    if (!apiToken || telegramLink.linked || !telegramLink.code) return;

    let cancelled = false;
    const intervalId = setInterval(async () => {
      try {
        const status = await fetchTelegramLinkStatus(apiToken);
        if (cancelled) return;

        const justLinked = status.linked && !telegramLinkWasLinkedRef.current;
        telegramLinkWasLinkedRef.current = status.linked;
        setTelegramLink(status);

        if (justLinked) {
          setTelegramLinkStatus("готово — Telegram и приложение теперь связаны");
          setToastMessage("Telegram подключен");
          await refreshLinkedLibrary(apiToken);
          if (cancelled) return;

          try {
            const spotifyStatus = await fetchSpotifyConnectionStatus(apiToken);
            if (!cancelled) {
              setSpotifyConnected(spotifyStatus.connected);
              setSpotifyProfileName(spotifyStatus.profile?.displayName ?? null);
            }
          } catch {
            // ignore spotify refresh errors here
          }
        }
      } catch {
        // ignore background link polling errors
      }
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [apiToken, telegramLink.code, telegramLink.linked]);

  useEffect(() => {
    if (!telegramLink.code) {
      setTelegramLinkQrDataUrl(null);
      return;
    }

    const deepLink = `https://t.me/every_you_bot?startapp=link_${telegramLink.code}`;
    QRCode.toDataURL(deepLink, {
      margin: 1,
      width: 480,
      color: { dark: "#111111", light: "#FFFFFF" },
    })
      .then((uri: string) => setTelegramLinkQrDataUrl(uri))
      .catch(() => setTelegramLinkQrDataUrl(null));
  }, [telegramLink.code]);

  useEffect(() => {
    if (!loaded || avatarUri || tab !== "home") return;
    setHeaderAvatarEmojiIndex((current) => (current + 1) % HEADER_AVATAR_EMOJIS.length);
  }, [tab, avatarUri, loaded]);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = setTimeout(() => setToastMessage(null), 2400);
    return () => clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    if (!loaded) return;

    let active = true;

    function acceptIncomingShare(url: string) {
      const normalized = clampText(url).trim();
      if (!normalized) return;

      if (normalized.includes("open.spotify.com/")) {
        setSpotifyUrl(normalized);
        setSpotifyStatus("получили ссылку из share, можно импортировать");
        setTab("add");
        setToastMessage("ссылка открыта в everyyou");
        return;
      }

      try {
        const parsed = new URL(normalized);
        const host = parsed.host.toLowerCase();
        const pathname = parsed.pathname.toLowerCase();
        const isEveryyouImport =
          parsed.protocol === "everyyou:" && (host === "import" || pathname === "/import");
        if (!isEveryyouImport) return;

        const sharedUrl = parsed.searchParams.get("url")?.trim() ?? "";
        const sharedTitle = clampText(parsed.searchParams.get("title") ?? "").toLowerCase();
        const sharedAuthor = clampText(parsed.searchParams.get("author") ?? "").toLowerCase();
        const sharedType = (parsed.searchParams.get("type") ?? "").toLowerCase();

        if (sharedUrl && sharedUrl.includes("open.spotify.com/")) {
          setSpotifyUrl(sharedUrl);
          setSpotifyStatus("получили ссылку из share, можно импортировать");
          setTab("add");
          setToastMessage("ссылка открыта в everyyou");
          return;
        }

        if (sharedType === "music" || sharedType === "book" || sharedType === "film") {
          setType(sharedType as ContentType);
          setSource("manual");
          setTitle(sharedTitle);
          setAuthorOrArtist(sharedAuthor);
          setTab("add");
          setToastMessage("контент из share открыт");
        }
      } catch {
        return;
      }
    }

    async function processInitialUrl() {
      const initialUrl = await Linking.getInitialURL();
      if (!active || !initialUrl) return;
      acceptIncomingShare(initialUrl);
    }

    processInitialUrl();

    const subscription = Linking.addEventListener("url", ({ url }) => {
      acceptIncomingShare(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [loaded]);

  useEffect(() => {
    if (!apiToken) return;

    const token = apiToken;
    let cancelled = false;
    async function loadSpotifyStatus() {
      try {
        const status = await fetchSpotifyConnectionStatus(token);
        if (cancelled) return;
        setSpotifyConnected(status.connected);
        setSpotifyProfileName(status.profile?.displayName ?? null);
      } catch {
        if (cancelled) return;
        setSpotifyConnected(false);
        setSpotifyProfileName(null);
      }
    }

    loadSpotifyStatus();
    return () => {
      cancelled = true;
    };
  }, [apiToken]);

  useEffect(() => {
    if (!loaded) return;
    if (syncStatus === "online" && library.length === 0) return;
    AsyncStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(library)).catch(() => undefined);
  }, [library, loaded, syncStatus]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_IMPORT, String(importedCount)).catch(() => undefined);
  }, [importedCount, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_ANALYSIS, JSON.stringify(analysisHistory)).catch(() => undefined);
  }, [analysisHistory, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_DAILY_STEPS, JSON.stringify(dailySteps)).catch(() => undefined);
  }, [dailySteps, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_HEALTH_STEPS_ENABLED, healthStepsEnabled ? "true" : "false").catch(() => undefined);
  }, [healthStepsEnabled, loaded]);

  const displayName = useMemo(() => getDisplayName(user), [user]);
  const hasCustomName = useMemo(() => hasValidCustomName(user), [user]);
  const namePlaceholder = useMemo(
    () => NAME_PLACEHOLDERS[phIdx % NAME_PLACEHOLDERS.length],
    [phIdx]
  );
  const canSave = useMemo(() => Boolean(type && clampText(title) && clampText(authorOrArtist)), [authorOrArtist, title, type]);
  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return library.find((item) => item.id === selectedId) ?? null;
  }, [library, selectedId]);
  const visibleLibrary = useMemo(() => {
    return deferredLibrary.filter((item) => {
      const typeMatch = typeFilter === "all" || item.type === typeFilter;
      const sourceMatch = sourceFilter === "all" || item.source === sourceFilter;
      const timeMatch =
        timeQualityFilter === "all"
          ? true
          : timeQualityFilter === "undated"
            ? item.consumedAt == null
            : item.timeOrigin === timeQualityFilter;
      return typeMatch && sourceMatch && timeMatch;
    });
  }, [deferredLibrary, sourceFilter, timeQualityFilter, typeFilter]);
  const counters = useMemo(() => {
    const byType: Record<ContentType, number> = { music: 0, book: 0, film: 0 };
    library.forEach((item) => {
      byType[item.type] += 1;
    });
    return { byType, total: library.length };
  }, [library]);
  const timeStats = useMemo(
    () => ({
      exact: library.filter((item) => item.timeOrigin === "exact").length,
      imported: library.filter((item) => item.timeOrigin === "imported").length,
      estimated: library.filter((item) => item.timeOrigin === "estimated").length,
      undated: library.filter((item) => item.consumedAt == null).length,
    }),
    [library]
  );
  const undatedVisibleLibrary = useMemo(
    () => visibleLibrary.filter((item) => item.source !== "manual" && item.consumedAt == null),
    [visibleLibrary]
  );
  const dailyStepsByDay = useMemo(
    () =>
      dailySteps.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.dayKey] = entry.steps;
        return acc;
      }, {}),
    [dailySteps]
  );
  const totalSteps = useMemo(() => dailySteps.reduce((sum, entry) => sum + entry.steps, 0), [dailySteps]);
  const selectedPendingImageItem = useMemo(
    () => pendingImageItems.find((item) => item.id === selectedPendingImageId) ?? null,
    [pendingImageItems, selectedPendingImageId]
  );

  function describeDateCoverage(items: Array<Pick<LibraryItem, "consumedAt" | "timeOrigin">>) {
    const exact = items.filter((item) => item.timeOrigin === "exact").length;
    const imported = items.filter((item) => item.timeOrigin === "imported").length;
    const estimated = items.filter((item) => item.timeOrigin === "estimated").length;
    const undated = items.filter((item) => item.consumedAt == null).length;
    const parts: string[] = [];
    if (exact > 0) parts.push(`точные даты: ${exact}`);
    if (imported > 0) parts.push(`из импорта: ${imported}`);
    if (estimated > 0) parts.push(`примерно: ${estimated}`);
    if (undated > 0) parts.push(`без даты: ${undated}`);
    return parts.join(" · ");
  }

  function buildDateInsight(items: Array<Pick<LibraryItem, "consumedAt" | "timeOrigin">>): DateInsight | null {
    const exact = items.filter((item) => item.timeOrigin === "exact" && item.consumedAt != null).length;
    const imported = items.filter((item) => item.timeOrigin === "imported" && item.consumedAt != null).length;
    const estimated = items.filter((item) => item.timeOrigin === "estimated" && item.consumedAt != null).length;
    const dated = exact + imported;
    const undated = items.filter((item) => item.consumedAt == null).length;

    if (dated === 0 && estimated === 0 && undated === 0) return null;

    if (dated > 0 && undated > 0) {
      return {
        title: `нашли реальные даты у ${dated} айтем(ов)`,
        body: "остальное нужно разложить вручную",
        meta: [exact > 0 ? `точные: ${exact}` : null, imported > 0 ? `из импорта: ${imported}` : null]
          .filter(Boolean)
          .join(" · "),
      };
    }

    if (dated > 0 && undated === 0) {
      return {
        title: "у найденного контента уже есть даты",
        body: "можно сразу смотреть его в календаре",
        meta: [exact > 0 ? `точные: ${exact}` : null, imported > 0 ? `из импорта: ${imported}` : null]
          .filter(Boolean)
          .join(" · "),
      };
    }

    if (estimated > 0 && undated === 0) {
      return {
        title: "время уже разложено примерно",
        body: "если захочешь, потом можно поправить отдельные карточки",
        meta: `примерно: ${estimated}`,
      };
    }

    return {
      title: "у этого импорта нет реальных дат",
      body: "после сохранения можно разложить контент вручную",
      meta: undated > 0 ? `без даты: ${undated}` : undefined,
    };
  }

  function buildSpreadDates(count: number, preset: TimelineSpreadPreset) {
    const now = new Date();
    const monthAnchors: Date[] = [];

    if (preset === "this_month") {
      monthAnchors.push(new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0));
    } else if (preset === "last_month") {
      monthAnchors.push(new Date(now.getFullYear(), now.getMonth() - 1, 1, 12, 0, 0, 0));
    } else if (preset === "last_6_months") {
      for (let offset = 0; offset < 6; offset += 1) {
        monthAnchors.push(new Date(now.getFullYear(), now.getMonth() - offset, 1, 12, 0, 0, 0));
      }
    } else if (preset === "very_old") {
      for (let yearOffset = 2; yearOffset <= 5; yearOffset += 1) {
        monthAnchors.push(new Date(now.getFullYear() - yearOffset, now.getMonth(), 1, 12, 0, 0, 0));
      }
    } else {
      for (let month = now.getMonth(); month >= 0; month -= 1) {
        monthAnchors.push(new Date(now.getFullYear(), month, 1, 12, 0, 0, 0));
      }
    }

    const dates: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const anchor = monthAnchors[index % monthAnchors.length];
      const day = 1 + (index % 24);
      const hour = 11 + (index % 8);
      dates.push(new Date(anchor.getFullYear(), anchor.getMonth(), day, hour, 0, 0, 0).getTime());
    }

    return dates.sort((a, b) => b - a);
  }

  async function spreadVisibleUndatedItems(preset: TimelineSpreadPreset) {
    const items = undatedVisibleLibrary;
    if (items.length === 0 || timelineSpreading) return;

    const dates = buildSpreadDates(items.length, preset);
    setTimelineSpreading(true);

    try {
      if (apiToken) {
        const updatedItems: LibraryItem[] = [];
        for (const [index, item] of items.entries()) {
          const updated = await updateItem(apiToken, {
            id: item.id,
            type: item.type,
            source: item.source,
            title: item.title,
            authorOrArtist: item.authorOrArtist,
            consumedAt: dates[index],
            timeOrigin: "estimated",
          });
          updatedItems.push(updated);
        }

        setLibrary((current) =>
          current.map((item) => updatedItems.find((updated) => updated.id === item.id) ?? item)
        );
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
      } else {
        setLibrary((current) =>
          current.map((item) => {
            const index = items.findIndex((candidate) => candidate.id === item.id);
            if (index === -1) return item;
            return { ...item, consumedAt: dates[index], timeOrigin: "estimated" };
          })
        );
      }

      setToastMessage(`разложили ${items.length} по времени`);
      setTimelinePromptVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось разложить по времени";
      setSyncStatus("offline");
      setSyncMessage(message);
      setToastMessage("не удалось разложить");
    } finally {
      setTimelineSpreading(false);
    }
  }

  async function assignTimelineToItem(itemId: string, preset: TimelineSpreadPreset) {
    const item = library.find((entry) => entry.id === itemId);
    if (!item || timelineSpreading) return;

    const [date] = buildSpreadDates(1, preset);
    setTimelineSpreading(true);

    try {
      if (apiToken) {
        const updated = await updateItem(apiToken, {
          id: item.id,
          type: item.type,
          source: item.source,
          title: item.title,
          authorOrArtist: item.authorOrArtist,
          consumedAt: date,
          timeOrigin: "estimated",
        });
        setLibrary((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
      } else {
        setLibrary((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, consumedAt: date, timeOrigin: "estimated" } : entry
          )
        );
      }

      setToastMessage("время обновили");
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось обновить время";
      setSyncStatus("offline");
      setSyncMessage(message);
      setToastMessage("не удалось обновить время");
    } finally {
      setTimelineSpreading(false);
    }
  }

  async function moveItemsToDate(itemIds: string[], targetDate: number) {
    const selectedItems = library.filter((item) => itemIds.includes(item.id));
    if (selectedItems.length === 0 || timelineSpreading) return;

    setTimelineSpreading(true);

    const movedAt = selectedItems.map((item, index) => {
      const original = getConsumptionDate(item);
      const base = new Date(targetDate);
      const sourceTime = original ? new Date(original) : null;
      const hours = sourceTime ? sourceTime.getHours() : 12;
      const minutes = sourceTime ? sourceTime.getMinutes() : Math.min(index * 3, 57);
      return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0).getTime();
    });

    try {
      if (apiToken) {
        const updatedItems: LibraryItem[] = [];
        for (const [index, item] of selectedItems.entries()) {
          const updated = await updateItem(apiToken, {
            id: item.id,
            type: item.type,
            source: item.source,
            title: item.title,
            authorOrArtist: item.authorOrArtist,
            consumedAt: movedAt[index],
            timeOrigin: "exact",
          });
          updatedItems.push(updated);
        }

        setLibrary((current) =>
          current.map((item) => updatedItems.find((updated) => updated.id === item.id) ?? item)
        );
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
      } else {
        setLibrary((current) =>
          current.map((item) => {
            const index = selectedItems.findIndex((candidate) => candidate.id === item.id);
            if (index === -1) return item;
            return { ...item, consumedAt: movedAt[index], timeOrigin: "exact" };
          })
        );
      }

      setToastMessage(selectedItems.length === 1 ? "дату перенесли" : `перенесли ${selectedItems.length} айтема`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось перенести дату";
      setSyncStatus("offline");
      setSyncMessage(message);
      setToastMessage("не удалось перенести");
    } finally {
      setTimelineSpreading(false);
    }
  }

  function promptTimelinePlacement() {
    if (undatedVisibleLibrary.length === 0) return;
    setTimelinePromptVisible(true);
    setTab("library");
  }

  function updatePendingImageItem(
    id: string,
    patch: Partial<Pick<PendingImageItem, "type" | "title" | "authorOrArtist" | "consumedAt" | "timeOrigin">>
  ) {
    setPendingImageItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              title: patch.title != null ? clampText(patch.title).toLowerCase() : item.title,
              authorOrArtist:
                patch.authorOrArtist != null
                  ? clampText(patch.authorOrArtist).toLowerCase()
                  : item.authorOrArtist,
            }
          : item
      )
    );
  }

  function assignPendingImageItemTime(id: string, preset: TimelineSpreadPreset) {
    const [date] = buildSpreadDates(1, preset);
    updatePendingImageItem(id, { consumedAt: date, timeOrigin: "estimated" });
  }

  function resetForm() {
    setType("");
    setSource("");
    setTitle("");
    setAuthorOrArtist("");
    setSpotifyUrl("");
  }

  async function addItem() {
    if (!canSave) return;
    const draft: LibraryItem = {
      id: uid(),
      type: type as ContentType,
      source: (source || "manual") as SourceType,
      title: clampText(title).toLowerCase(),
      authorOrArtist: clampText(authorOrArtist).toLowerCase(),
      createdAt: Date.now(),
      consumedAt: Date.now(),
      timeOrigin: "exact",
    };

    if (apiToken) {
      try {
        setSyncStatus("syncing");
        const saved = await createItem(apiToken, draft);
        setLibrary((current) => [saved, ...current]);
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
        resetForm();
        setTab("library");
        setSelectedId(saved.id);
        setToastMessage("добавили в библиотеку");
        fireAnalytics("item_created", { type: saved.type, source: saved.source, mode: "manual" });
        return;
      } catch {
        setLibrary((current) => [draft, ...current]);
        setSyncStatus("offline");
        setSyncMessage("не удалось сохранить на сервер, айтем добавлен локально");
        setToastMessage("сохранили локально");
      }
    } else {
      setLibrary((current) => [draft, ...current]);
      setToastMessage("добавили в библиотеку");
    }

    fireAnalytics("item_created", { type: draft.type, source: draft.source, mode: "manual_local" });

    resetForm();
    setTab("library");
    setSelectedId(draft.id);
  }

  function startEdit(id: string) {
    const item = library.find((entry) => entry.id === id);
    if (!item) return;
    setEditingId(id);
    setType(item.type);
    setSource(item.source);
    setTitle(item.title);
    setAuthorOrArtist(item.authorOrArtist);
    setTab("add");
  }

  async function saveEdit() {
    if (!editingId || !canSave) return;

    const updatedDraft = {
      id: editingId,
      type: type as ContentType,
      source: (source || "manual") as SourceType,
      title: clampText(title).toLowerCase(),
      authorOrArtist: clampText(authorOrArtist).toLowerCase(),
      consumedAt:
        library.find((item) => item.id === editingId)?.consumedAt ??
        ((source || "manual") === "manual" ? Date.now() : undefined),
      timeOrigin:
        library.find((item) => item.id === editingId)?.timeOrigin ??
        ((source || "manual") === "manual" ? "exact" : undefined),
    };

    if (apiToken) {
      try {
        setSyncStatus("syncing");
        const saved = await updateItem(apiToken, updatedDraft);
        setLibrary((current) => current.map((item) => (item.id === editingId ? saved : item)));
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
        setToastMessage("сохранили изменения");
        fireAnalytics("item_updated", { type: saved.type, source: saved.source });
      } catch {
        setLibrary((current) =>
          current.map((item) => (item.id === editingId ? { ...item, ...updatedDraft } : item))
        );
        setSyncStatus("offline");
        setSyncMessage("не удалось обновить сервер, изменения сохранены локально");
        setToastMessage("обновили локально");
      }
    } else {
      setLibrary((current) =>
        current.map((item) => (item.id === editingId ? { ...item, ...updatedDraft } : item))
      );
      setToastMessage("сохранили изменения");
      fireAnalytics("item_updated", { type: updatedDraft.type, source: updatedDraft.source, mode: "local" });
    }

    setSelectedId(editingId);
    setEditingId(null);
    resetForm();
    setTab("library");
  }

  async function removeItem(id: string) {
    if (apiToken) {
      try {
        setSyncStatus("syncing");
        await deleteItem(apiToken, id);
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
      } catch {
        setSyncStatus("offline");
        setSyncMessage("не удалось удалить на сервере, айтем убран локально");
      }
    }

    setLibrary((current) => current.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
    setToastMessage("удалили из библиотеки");
    fireAnalytics("item_deleted");
  }

  async function runFakeImport() {
    if (isImporting) return;
    setIsImporting(true);
    await new Promise((resolve) => setTimeout(resolve, 900));

    const fakeItems: LibraryItem[] = [
      {
        id: uid(),
        type: "music",
        source: "import_spotify",
        title: "about today",
        authorOrArtist: "the national",
        createdAt: Date.now(),
      },
      {
        id: uid(),
        type: "music",
        source: "import_spotify",
        title: "codex",
        authorOrArtist: "radiohead",
        createdAt: Date.now(),
      },
    ];

    setImportedCount((current) => current + 37);
    setLibrary((current) => [...fakeItems, ...current]);
    setIsImporting(false);
    setTab("library");
    setTimelinePromptVisible(true);
  }

  async function importFromScreenshot() {
    if (isScreenshotImporting) return;

    try {
      setIsScreenshotImporting(true);
      setScreenshotStatus("открываем галерею...");
      setScreenshotDateInsight(null);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.9,
        base64: true,
      });

      if (result.canceled || !result.assets.length) {
        setScreenshotStatus("импорт отменен");
        setIsScreenshotImporting(false);
        return;
      }

      const assets = result.assets.filter((asset) => asset.base64);
      if (assets.length === 0) {
        setScreenshotStatus("в выбранных файлах не нашлось изображений");
        setIsScreenshotImporting(false);
        return;
      }

      const parsedItems: Awaited<ReturnType<typeof analyzeScreenshot>> = [];
      for (const [index, asset] of assets.entries()) {
        setScreenshotStatus(`анализируем изображения: ${index + 1}/${assets.length}...`);
        const chunk = await analyzeScreenshot({
          imageBase64: asset.base64 as string,
          mimeType: asset.mimeType ?? "image/jpeg",
        });
        parsedItems.push(...chunk);
      }

      if (parsedItems.length === 0) {
        setScreenshotStatus(
          "не могу отнести это ни к музыке, ни к книгам, ни к фильмам — попробуй другое изображение"
        );
        setIsScreenshotImporting(false);
        return;
      }

      const importedItems: PendingImageItem[] = parsedItems.map((item) => ({
        id: uid(),
        type: item.type,
        source: "manual",
        title: item.title,
        authorOrArtist: item.authorOrArtist,
        createdAt: Date.now(),
        consumedAt: undefined,
        timeOrigin: undefined,
      }));
      setPendingImageItems(importedItems);
      const coverage = describeDateCoverage(importedItems);
      setScreenshotDateInsight(buildDateInsight(importedItems));
      setScreenshotStatus(
        `нашли ${importedItems.length} айтем(ов), проверь перед сохранением${coverage ? ` · ${coverage}` : ""}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось проанализировать изображение";
      setScreenshotStatus(message);
    } finally {
      setIsScreenshotImporting(false);
    }
  }

  function removePendingImageItem(id: string) {
    setPendingImageItems((current) => current.filter((item) => item.id !== id));
    if (selectedPendingImageId === id) {
      setSelectedPendingImageId(null);
    }
  }

  function cancelPendingImageImport() {
    setPendingImageItems([]);
    setSelectedPendingImageId(null);
    setScreenshotStatus("импорт изображений отменен");
    setScreenshotDateInsight(null);
  }

  async function confirmPendingImageImport() {
    if (pendingImageItems.length === 0) {
      setScreenshotStatus("нечего сохранять");
      return;
    }

    try {
      setConfirmingPendingImageImport(true);
      setScreenshotStatus("сохраняем выбранное...");

      if (apiToken) {
        const savedItems: LibraryItem[] = [];
        for (const item of pendingImageItems) {
          const saved = await createItem(apiToken, item);
          savedItems.push(saved);
        }
        setLibrary((current) => [...savedItems, ...current]);
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
        setSelectedId(savedItems[0]?.id ?? null);
      } else {
        setLibrary((current) => [...pendingImageItems, ...current]);
        setSelectedId(pendingImageItems[0]?.id ?? null);
      }

      setScreenshotStatus(`добавили ${pendingImageItems.length} айтем(ов) из изображений`);
      const hasUndatedItems = pendingImageItems.some((item) => item.consumedAt == null);
      setPendingImageItems([]);
      setSelectedPendingImageId(null);
      setScreenshotDateInsight(null);
      setTab("library");
      setToastMessage(`добавили ${pendingImageItems.length} айтем(ов)`);
      setTimelinePromptVisible(hasUndatedItems);
      fireAnalytics("image_import_completed", {
        count: pendingImageItems.length,
        undatedCount: pendingImageItems.filter((item) => item.consumedAt == null).length,
      });
    } finally {
      setConfirmingPendingImageImport(false);
    }
  }

  async function importSpotifyLink() {
    const normalizedUrl = spotifyUrl.trim();
    if (!normalizedUrl) {
      setSpotifyStatus("вставь ссылку spotify или Яндекс.Музыки");
      return;
    }

    const isYandexMusic = /(^|\.)music\.yandex\.(ru|com)(\/|$)/i.test(normalizedUrl);
    const service = isYandexMusic ? "Яндекс.Музыки" : "spotify";

    try {
      setSpotifyStatus(`тянем данные из ${service}...`);
      setSpotifyDateInsight(null);
      const parsedItems = await importFromSpotifyUrl(normalizedUrl);

      if (parsedItems.length === 0) {
        setSpotifyStatus(`${service} ничего не вернул`);
        return;
      }

      const importedItems: LibraryItem[] = parsedItems.map((item) => ({
        id: uid(),
        type: item.type,
        source: isYandexMusic ? "import_yandex_music" : "import_spotify",
        title: item.title,
        authorOrArtist: item.authorOrArtist,
        createdAt: Date.now(),
        consumedAt: undefined,
        timeOrigin: undefined,
      }));

      if (apiToken) {
        const savedItems: LibraryItem[] = [];
        for (const item of importedItems) {
          const saved = await createItem(apiToken, item);
          savedItems.push(saved);
        }
        setLibrary((current) => [...savedItems, ...current]);
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
      } else {
        setLibrary((current) => [...importedItems, ...current]);
      }

      setImportedCount((current) => current + importedItems.length);
      const coverage = describeDateCoverage(importedItems);
      setSpotifyDateInsight(buildDateInsight(importedItems));
      setSpotifyStatus(
        `добавили ${importedItems.length} трек(ов) из ${service}${coverage ? ` · ${coverage}` : ""}`
      );
      setSpotifyUrl("");
      setTab("library");
      setToastMessage(`импортировали ${importedItems.length} трек(ов)`);
      setTimelinePromptVisible(true);
      fireAnalytics("music_link_import_completed", { count: importedItems.length, service: isYandexMusic ? "yandex_music" : "spotify" });
    } catch (error) {
      const message = error instanceof Error ? error.message : `не удалось импортировать из ${service}`;
      setSpotifyStatus(message);
      setToastMessage("импорт не удался");
    }
  }

  async function importPlatformFile(
    platform: "livelib" | "goodreads" | "letterboxd" | "lastfm" | "kinopoisk" | "mubi"
  ) {
    if (filePickerBusyRef.current) {
      setFileImportStatus("уже открыт выбор файла");
      return;
    }

    filePickerBusyRef.current = true;
    try {
      setFileImportBusy(true);
      setFileImportCanCancel(true);
      filePickerCancelledRef.current = false;
      setFileImportStatus("открываем файлы...");
      setFileImportDateInsight(null);

      await new Promise((resolve) => setTimeout(resolve, 220));
      if (filePickerCancelledRef.current) {
        setFileImportStatus("пока не открываем файлы");
        return;
      }

      setFileImportCanCancel(false);
      setFileImportBusy(false);
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: ["text/csv", "text/plain", "application/vnd.ms-excel"],
      });

      if (result.canceled || !result.assets[0]?.uri) {
        setFileImportStatus("импорт отменен");
        return;
      }

      setFileImportStatus("читаем файл...");
      const fileText = await fetch(result.assets[0].uri).then((response) => response.text());
      const parsedItems = parseImportedFile(platform, fileText);

      if (parsedItems.length === 0) {
        setFileImportStatus("ничего не удалось импортировать");
        return;
      }

      if (apiToken) {
        let created = 0;
        for (const item of parsedItems) {
          await createItem(apiToken, item);
          created += 1;
        }
        const remoteLibrary = await fetchItems(apiToken);
        setLibrary(remoteLibrary);
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
        const coverage = describeDateCoverage(parsedItems);
        setFileImportDateInsight(buildDateInsight(parsedItems));
        setFileImportStatus(`добавили ${created} айтем(ов) из файла${coverage ? ` · ${coverage}` : ""}`);
        setToastMessage(`загрузили ${created} айтем(ов)`);
        fireAnalytics("file_import_completed", { platform, count: created });
      } else {
        setLibrary((current) => [
          ...parsedItems.map((item) => ({
            id: uid(),
            ...item,
            createdAt: Date.now(),
            consumedAt: undefined,
            timeOrigin: undefined,
          })),
          ...current,
        ]);
        const coverage = describeDateCoverage(parsedItems);
        setFileImportDateInsight(buildDateInsight(parsedItems));
        setFileImportStatus(
          `добавили ${parsedItems.length} айтем(ов) локально${coverage ? ` · ${coverage}` : ""}`
        );
        setToastMessage(`загрузили ${parsedItems.length} айтем(ов)`);
        fireAnalytics("file_import_completed", { platform, count: parsedItems.length, mode: "local" });
      }

      setTab("library");
      setTimelinePromptVisible(parsedItems.some((item) => item.consumedAt == null));
    } catch (error) {
      const message = error instanceof Error ? error.message : "file import failed";
      setFileImportStatus(message);
    } finally {
      setFileImportBusy(false);
      setFileImportCanCancel(false);
      setTimeout(() => {
        filePickerCancelledRef.current = false;
        filePickerBusyRef.current = false;
      }, 350);
    }
  }

  function cancelFileImportOpening() {
    if (!fileImportCanCancel) return;
    filePickerCancelledRef.current = true;
    setFileImportBusy(false);
    setFileImportCanCancel(false);
    setFileImportStatus("пока не открываем файлы");
  }

  async function persistImportedLibraryItems(
    items: Array<
      Pick<LibraryItem, "type" | "source" | "title" | "authorOrArtist" | "consumedAt" | "timeOrigin">
    >,
    options: {
      successLabel: string;
      successToast: string;
      analyticsEvent: string;
      analyticsProperties?: Record<string, unknown>;
      statusSetter: (message: string | null) => void;
      dateInsightSetter: (value: DateInsight | null) => void;
    }
  ) {
    if (items.length === 0) {
      options.statusSetter("ничего не нашли");
      return;
    }

    if (apiToken) {
      let created = 0;
      for (const item of items) {
        await createItem(apiToken, item);
        created += 1;
      }
      const remoteLibrary = await fetchItems(apiToken);
      setLibrary(remoteLibrary);
      setSyncStatus("online");
      setSyncMessage("данные синхронизируются с сервером");
      const coverage = describeDateCoverage(items);
      options.dateInsightSetter(buildDateInsight(items));
      options.statusSetter(`${options.successLabel}${coverage ? ` · ${coverage}` : ""}`);
      setToastMessage(options.successToast);
      fireAnalytics(options.analyticsEvent, { count: created, ...(options.analyticsProperties ?? {}) });
    } else {
      setLibrary((current) => [
        ...items.map((item) => ({
          id: uid(),
          ...item,
          createdAt: Date.now(),
        })),
        ...current,
      ]);
      const coverage = describeDateCoverage(items);
      options.dateInsightSetter(buildDateInsight(items));
      options.statusSetter(`${options.successLabel}${coverage ? ` · ${coverage}` : ""}`);
      setToastMessage(options.successToast);
      fireAnalytics(options.analyticsEvent, { count: items.length, mode: "local", ...(options.analyticsProperties ?? {}) });
    }

    setTab("library");
    setTimelinePromptVisible(items.some((item) => item.consumedAt == null));
  }

  async function importLastfmProfileByUsername() {
    const normalizedUsername = clampText(lastfmUsername || connectedSources.lastfm?.profile || "");
    if (!normalizedUsername) {
      setFileImportStatus("введи username last.fm");
      return;
    }

    try {
      setFileImportStatus("смотрим профиль last.fm...");
      setFileImportDateInsight(null);
      setFileImportStatus("тянем recent tracks...");
      const items = await importFromLastfmProfile(normalizedUsername);
      await persistImportedLibraryItems(
        items.map((item) => ({
          ...item,
          consumedAt: item.consumedAt ?? undefined,
          timeOrigin: item.timeOrigin ?? undefined,
        })),
        {
        successLabel: `добавили ${items.length} трек(ов) из last.fm`,
        successToast: `импортировали ${items.length} трек(ов)`,
        analyticsEvent: "lastfm_profile_import_completed",
        analyticsProperties: { username: normalizedUsername },
        statusSetter: setFileImportStatus,
        dateInsightSetter: setFileImportDateInsight,
        }
      );
      if (apiToken) {
        try {
          const result = await saveConnectedSource(apiToken, { platform: "lastfm", profile: normalizedUsername });
          setConnectedSources((current) => ({
            ...current,
            lastfm: { profile: result.source.profile, lastSyncedAt: result.source.lastSyncedAt },
          }));
          setLastfmUsername(result.source.profile);
        } catch {
          // import can still be successful even if source save failed
        }
      }
      setFileImportStatus(
        items.length > 0
          ? `готово: нашли ${items.length} трек(ов) в last.fm`
          : "ничего не нашли в этом профиле"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось импортировать профиль last.fm";
      setFileImportStatus(message);
    }
  }

  async function importLetterboxdPublicProfile() {
    const normalizedProfile = clampText(letterboxdProfile || connectedSources.letterboxd?.profile || "");
    if (!normalizedProfile) {
      setFileImportStatus("вставь username или ссылку на profile letterboxd");
      return;
    }

    try {
      setFileImportStatus("смотрим public profile letterboxd...");
      setFileImportDateInsight(null);
      setFileImportStatus("читаем diary и watched...");
      const items = await importFromLetterboxdProfile(normalizedProfile);
      await persistImportedLibraryItems(
        items.map((item) => ({
          ...item,
          consumedAt: item.consumedAt ?? undefined,
          timeOrigin: item.timeOrigin ?? undefined,
        })),
        {
        successLabel: `добавили ${items.length} фильм(ов) из Letterboxd`,
        successToast: `импортировали ${items.length} фильм(ов)`,
        analyticsEvent: "letterboxd_profile_import_completed",
        analyticsProperties: { profile: normalizedProfile },
        statusSetter: setFileImportStatus,
        dateInsightSetter: setFileImportDateInsight,
        }
      );
      if (apiToken) {
        try {
          const result = await saveConnectedSource(apiToken, { platform: "letterboxd", profile: normalizedProfile });
          setConnectedSources((current) => ({
            ...current,
            letterboxd: { profile: result.source.profile, lastSyncedAt: result.source.lastSyncedAt },
          }));
          setLetterboxdProfile(result.source.profile);
        } catch {
          // import can still be successful even if source save failed
        }
      }
      setFileImportStatus(
        items.length > 0
          ? `готово: нашли ${items.length} фильм(ов) в letterboxd`
          : "ничего не нашли в этом профиле"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось импортировать profile Letterboxd";
      setFileImportStatus(message);
    }
  }

  async function disconnectProfileSource(platform: "lastfm" | "letterboxd", deleteContent = false) {
    if (!apiToken || fileImportBusy) return;

    try {
      setFileImportBusy(true);
      setFileImportStatus(deleteContent ? "отвязываем источник и убираем его импорт..." : "отвязываем источник...");
      const result = await disconnectConnectedSource(apiToken, { platform, deleteContent });
      const remoteLibrary = await fetchItems(apiToken);
      setLibrary(remoteLibrary);
      setConnectedSources((current) => ({
        ...current,
        [platform]: null,
      }));
      if (platform === "lastfm") {
        setLastfmUsername("");
      } else {
        setLetterboxdProfile("");
      }
      setFileImportDateInsight(null);
      setFileImportStatus(
        deleteContent
          ? `готово: отвязали ${platform} и убрали ${result.deletedItems} айтем(ов)`
          : `готово: ${platform} больше не подключен`
      );
      setToastMessage(
        deleteContent
          ? `${platform} отвязали и почистили импорт`
          : `${platform} отвязали`
      );
      fireAnalytics("source_disconnected", { platform, deleteContent, deletedItems: result.deletedItems });
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось отвязать источник";
      setFileImportStatus(message);
    } finally {
      setFileImportBusy(false);
    }
  }

  async function disconnectSpotifySource(deleteContent = false) {
    if (!apiToken || spotifyOAuthLoading || spotifyPlaylistLoading) return;

    try {
      setSpotifyStatus(deleteContent ? "отвязываем spotify и убираем его импорт..." : "отвязываем spotify...");
      const result = await disconnectSpotifyConnection(apiToken, deleteContent);
      const remoteLibrary = await fetchItems(apiToken);
      setLibrary(remoteLibrary);
      setSpotifyConnected(false);
      setSpotifyProfileName(null);
      setSpotifyPlaylists([]);
      setSpotifyDateInsight(null);
      setSpotifyStatus(
        deleteContent
          ? `готово: spotify отвязали и убрали ${result.deletedItems} айтем(ов)`
          : "готово: spotify больше не подключен"
      );
      setToastMessage(deleteContent ? "spotify отвязали и почистили импорт" : "spotify отвязали");
      fireAnalytics("source_disconnected", { platform: "spotify", deleteContent, deletedItems: result.deletedItems });
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось отвязать spotify";
      setSpotifyStatus(message);
    }
  }

  async function refreshSpotifyConnection(showSuccessMessage = false) {
    if (!apiToken) {
      setSpotifyStatus("backend token missing");
      return false;
    }

    try {
      const status = await fetchSpotifyConnectionStatus(apiToken);
      setSpotifyConnected(status.connected);
      setSpotifyProfileName(status.profile?.displayName ?? null);
      if (!status.connected) {
        setSpotifyStatus("spotify пока не подключен");
        return false;
      }
      if (showSuccessMessage) {
        setSpotifyStatus(
          status.profile?.displayName
            ? `spotify подключен: ${status.profile.displayName}`
            : "spotify подключен"
        );
        setToastMessage("spotify обновлен");
        fireAnalytics("spotify_connection_refreshed", { connected: true });
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось проверить spotify";
      setSpotifyStatus(message);
      return false;
    }
  }

  async function connectSpotifyAccount() {
    if (!apiToken || spotifyOAuthLoading) return;

    try {
      setSpotifyOAuthLoading(true);
      setSpotifyStatus("открываем spotify login...");
      const { authUrl } = await getSpotifyOAuthUrl(apiToken);
      const canOpen = await Linking.canOpenURL(authUrl);
      if (!canOpen) {
        throw new Error("не удалось открыть spotify login");
      }
      await Linking.openURL(authUrl);
      setSpotifyStatus("заверши логин в браузере, потом вернись и нажми обновить spotify");
    } catch (error) {
      const message = error instanceof Error ? error.message : "spotify oauth failed";
      setSpotifyStatus(message);
    } finally {
      setSpotifyOAuthLoading(false);
    }
  }

  async function loadSpotifyPlaylistsList() {
    if (!apiToken || spotifyPlaylistLoading) return;

    try {
      setSpotifyPlaylistLoading(true);
      const statusOk = spotifyConnected ? true : await refreshSpotifyConnection();
      if (!statusOk) return;
      setSpotifyStatus("грузим плейлисты...");
      const data = await fetchSpotifyPlaylists(apiToken);
      setSpotifyPlaylists(data.playlists);
      setSpotifyStatus(
        data.playlists.length > 0
          ? `нашли ${data.playlists.length} плейлист(ов) spotify`
          : "плейлисты не нашлись"
      );
      fireAnalytics("spotify_playlists_loaded", { count: data.playlists.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось загрузить плейлисты";
      setSpotifyStatus(message);
    } finally {
      setSpotifyPlaylistLoading(false);
    }
  }

  async function importSpotifyAccountSource(
    input: { mode: "liked" | "recently_played" | "playlist"; playlistId?: string },
    successLabel: string
  ) {
    if (!apiToken) {
      setSpotifyStatus("backend token missing");
      return;
    }

    try {
      const statusOk = spotifyConnected ? true : await refreshSpotifyConnection();
      if (!statusOk) return;

      setSpotifyStatus(`тянем ${successLabel} из spotify...`);
      setSpotifyDateInsight(null);
      const result = await importFromSpotifyUser(apiToken, input);
      setImportedCount((current) => current + result.importedCount);

      const remoteLibrary = await fetchItems(apiToken);
      setLibrary(remoteLibrary);
      setSyncStatus("online");
      setSyncMessage("данные синхронизируются с сервером");
      setSpotifyDateInsight(
        buildDateInsight([
          ...Array.from({ length: result.dateCoverage?.exact ?? 0 }, () => ({ consumedAt: 1, timeOrigin: "exact" as const })),
          ...Array.from({ length: result.dateCoverage?.imported ?? 0 }, () => ({ consumedAt: 1, timeOrigin: "imported" as const })),
          ...Array.from({ length: result.dateCoverage?.undated ?? 0 }, () => ({ consumedAt: undefined, timeOrigin: undefined })),
        ])
      );
      if ((result.skippedCount ?? 0) > 0) {
        setSpotifyStatus(
          `добавили ${result.importedCount} трек(ов) из ${successLabel}, пропустили ${result.skippedCount} дублей${result.dateSummary ? ` · ${result.dateSummary}` : ""}`
        );
      } else {
        setSpotifyStatus(
          `добавили ${result.importedCount} трек(ов) из ${successLabel}${result.dateSummary ? ` · ${result.dateSummary}` : ""}`
        );
      }
      setTab("library");
      setToastMessage(`добавили ${result.importedCount} трек(ов)`);
      setTimelinePromptVisible(input.mode === "playlist");
      fireAnalytics("spotify_account_import_completed", {
        mode: input.mode,
        importedCount: result.importedCount,
        skippedCount: result.skippedCount ?? 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось импортировать из spotify";
      setSpotifyStatus(message);
      setToastMessage("импорт не удался");
    }
  }

  async function runFakeAnalysis(range?: { from: number; to: number; label: string }) {
    if (analysisRunning) return;
    setAnalysisRunning(true);
    setAnalysisRunningScope(range ? "range" : "full");
    fireAnalytics("vibecheck_started", {
      librarySize: counters.total,
      tier: "regular",
      periodLabel: range?.label ?? null,
      periodFrom: range?.from ?? null,
      periodTo: range?.to ?? null,
    });

    try {
      if (apiToken) {
        const data = await runVibeCheck(apiToken, range ? { from: range.from, to: range.to } : undefined);
        const result: AnalysisRun = {
          id: uid(),
          createdAt: Date.now(),
          itemCount: data.itemCount,
          persona: data.persona,
          summary: data.summary,
          highlights: data.highlights,
          basis: data.basis ?? [],
          periodLabel: range?.label,
        };

        setAnalysisResult(result);
        setAnalysisHistory([result]);
        setToastMessage("вайбчек готов");
        fireAnalytics("vibecheck_completed", {
          itemCount: data.itemCount,
          tier: "regular",
          periodLabel: range?.label ?? null,
        });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 900));

      const total = counters.total;
      const byType = counters.byType;

      const result: AnalysisRun = {
        id: uid(),
        createdAt: Date.now(),
        itemCount: total,
        persona: total === 0 ? "" : "вкус пока без легенды",
        summary:
          total === 0
            ? "пока пусто. добавьте пару айтемов и мы начнем собирать ваш паттерн вкуса."
            : `в библиотеке ${total} айтемов. музыка: ${byType.music}, книги: ${byType.book}, фильмы: ${byType.film}.`,
        highlights:
          total === 0
            ? ["можно начать с импорта spotify", "или добавить что-то вручную"]
            : [
                "вкусу явно нравится ходить между поп-крючками и вещами посложнее",
              "повторяющиеся имена и настроения быстро выдают твой текущий эмоциональный коридор",
              "это быстрый вайбчек: он скорее намечает настроение, чем копает глубоко",
              ],
        basis:
          total === 0
            ? []
            : ["последние добавленные айтемы", "повторяющиеся имена и настроения"],
        periodLabel: range?.label,
      };

      setAnalysisResult(result);
      setAnalysisHistory([result]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "vibe check failed";
      const fallback: AnalysisRun = {
        id: uid(),
        createdAt: Date.now(),
        itemCount: counters.total,
        persona: "",
        summary: `не удалось провести серверный вайбчек: ${message}`,
        highlights: ["проверь настройки сервера", "и попробуй еще раз"],
        basis: [],
        periodLabel: range?.label,
      };
      setAnalysisResult(fallback);
      setAnalysisHistory([fallback]);
    } finally {
      setAnalysisRunning(false);
      setAnalysisRunningScope(null);
    }
  }

  async function runDeepAnalysis(range?: { from: number; to: number; label: string }) {
    if (deepAnalysisRunning) return;
    if (deepAnalysisAccess === "paywall") {
      setToastMessage("2 бесплатных глубоких вайбчека уже использованы");
      fireAnalytics("deep_vibe_paywall_seen");
      return;
    }

    setDeepAnalysisRunning(true);
    fireAnalytics("vibecheck_started", {
      librarySize: counters.total,
      tier: "deep",
      usesLeft: deepAnalysisUsesLeft,
      periodLabel: range?.label ?? null,
      periodFrom: range?.from ?? null,
      periodTo: range?.to ?? null,
    });

    try {
      if (!apiToken) {
        throw new Error("для вайбчека без прикола нужен backend");
      }

      const data = await runDeepVibeCheck(apiToken, range ? { from: range.from, to: range.to } : undefined);
      const result: AnalysisRun = {
        id: uid(),
        createdAt: Date.now(),
        itemCount: data.itemCount,
        summary: data.summary,
        highlights: data.highlights,
        basis: data.basis ?? [],
        recommendations: data.recommendations ?? [],
        usesLeft: data.usesLeft,
        periodLabel: range?.label,
      };

      setDeepAnalysisResult(result);
      setDeepAnalysisAccess(data.access);
      setDeepAnalysisUsesLeft(data.usesLeft);
      setDeepAnalysisTotalFreeUses(data.totalFreeUses);
      setToastMessage("вайбчек без прикола готов");
      fireAnalytics("vibecheck_completed", {
        itemCount: data.itemCount,
        tier: "deep",
        usesLeft: data.usesLeft,
        periodLabel: range?.label ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "deep vibe failed";
      if (message === "paywall") {
        setDeepAnalysisAccess("paywall");
        setDeepAnalysisUsesLeft(0);
        setToastMessage("2 бесплатных глубоких вайбчека уже использованы");
        fireAnalytics("deep_vibe_paywall_seen");
        return;
      }

      const friendlySummary =
        message.includes("404")
          ? "вайбчек без прикола пока не доехал до сервера. попробуй еще раз чуть позже, когда обновится backend."
          : `не удалось провести вайбчек без прикола: ${message}`;
      const friendlyHighlights = message.includes("404")
        ? ["это похоже на старый деплой сервера", "не твоя ошибка — просто повтори попытку позже"]
        : ["проверь настройки сервера", "и попробуй еще раз"];

      const fallback: AnalysisRun = {
        id: uid(),
        createdAt: Date.now(),
        itemCount: counters.total,
        summary: friendlySummary,
        highlights: friendlyHighlights,
        basis: [],
        recommendations: [],
        usesLeft: deepAnalysisUsesLeft,
        periodLabel: range?.label,
      };
      setDeepAnalysisResult(fallback);
    } finally {
      setDeepAnalysisRunning(false);
    }
  }

  async function saveProfileName() {
    const normalized = clampText(nameDraft);
    if (!normalized) return;

    await setStoredGuestName(normalized);
    if (apiToken) {
      await saveSharedProfile(apiToken, { displayName: normalized, avatarUrl: avatarUri, themeMode });
    }
    setUser(splitDisplayName(normalized));
    setNameDraft(normalized);
    fireAnalytics("profile_saved", { hasName: true });
  }

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]?.uri) return;
    const nextAvatarUri = apiToken ? await uploadSharedProfileAvatar(apiToken, result.assets[0].uri) : result.assets[0].uri;
    await setStoredAvatarUri(nextAvatarUri);
    setAvatarUri(nextAvatarUri);
    setToastMessage("аватар обновили");
    fireAnalytics("avatar_updated");
  }

  async function clearAvatar() {
    await clearStoredAvatarUri();
    if (apiToken) await saveSharedProfile(apiToken, { displayName: nameDraft || null, avatarUrl: null, themeMode });
    setAvatarUri(null);
    setToastMessage("аватар убрали");
    fireAnalytics("avatar_cleared");
  }

  async function updateThemeMode(nextMode: ThemeMode) {
    await setStoredThemeMode(nextMode);
    if (apiToken) await saveSharedProfile(apiToken, { displayName: nameDraft || null, avatarUrl, themeMode: nextMode });
    setThemeMode(nextMode);
    setToastMessage(nextMode === "dark" ? "включили темную тему" : "вернули светлую тему");
    fireAnalytics("theme_changed", { mode: nextMode });
  }

  async function createTelegramLinkCode() {
    if (!apiToken || telegramLinkLoading) return;

    try {
      setTelegramLinkLoading(true);
      setTelegramLinkStatus("готовим код для Telegram...");
      const data = await startTelegramLink(apiToken);
      setTelegramLink({
        linked: false,
        telegramOwnerKey: null,
        code: data.code,
        expiresAt: data.expiresAt,
      });
      telegramLinkWasLinkedRef.current = false;
      setTelegramLinkStatus("код готов — введи его в mini app");
      setToastMessage("код для Telegram готов");
      fireAnalytics("telegram_link_code_created");
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось создать код";
      setTelegramLinkStatus(message);
      setToastMessage("не удалось создать код");
    } finally {
      setTelegramLinkLoading(false);
    }
  }

  async function openTelegramLinkFlow() {
    const code = telegramLink.code?.trim().toUpperCase();
    if (!code) {
      setTelegramLinkStatus("сначала подготовь код для Telegram");
      return;
    }

    try {
      await Linking.openURL(`https://t.me/every_you_bot?startapp=link_${code}`);
    } catch {
      setTelegramLinkStatus("не получилось открыть Telegram автоматически");
    }
  }

  async function finishOnboarding() {
    await setStoredOnboardingDone(true);
    setShowOnboarding(false);
    setOnboardingStep(0);
  }

  function nextOnboardingStep() {
    const lastStep = onboardingVariant === "linked" ? 1 : 2;
    if (onboardingStep >= lastStep) {
      void finishOnboarding();
      return;
    }
    setOnboardingStep((current) => current + 1);
  }

  async function skipOnboarding() {
    await setStoredOnboardingDone(true);
    setShowOnboarding(false);
    setOnboardingStep(0);
  }

  function replayOnboarding() {
    setOnboardingVariant(library.length > 0 ? "linked" : "fresh");
    setOnboardingStep(0);
    setShowOnboarding(true);
  }

  function updateHealthStepsEnabled(value: boolean) {
    setHealthStepsEnabled(value);
    if (value) {
      setToastMessage("когда подключим здоровье, шаги появятся в календаре по дням");
    }
  }

  return {
    tab,
    setTab,
    displayName,
    hasCustomName,
    nameDraft,
    avatarUri,
    headerAvatarEmoji: HEADER_AVATAR_EMOJIS[headerAvatarEmojiIndex],
    themeMode,
    telegramLink,
    telegramLinkLoading,
    telegramLinkStatus,
    telegramLinkQrDataUrl,
    namePlaceholder,
    syncStatus,
    syncMessage,
    toastMessage,
    editingId,
    isImporting,
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
    lastfmUsername,
    letterboxdProfile,
    connectedSources,
    fileImportStatus,
    fileImportBusy,
    fileImportCanCancel,
    fileImportDateInsight,
    type,
    source,
    title,
    authorOrArtist,
    phIdx,
    canSave,
    typeFilter,
    sourceFilter,
    timeQualityFilter,
    undatedVisibleLibrary,
    selectedItem,
    library,
    visibleLibrary,
    counters,
    timeStats,
    dailyStepsByDay,
    totalSteps,
    healthStepsEnabled,
    analysisRunning,
    analysisRunningScope,
    analysisResult,
    analysisHistory,
    deepAnalysisRunning,
    deepAnalysisResult,
    deepAnalysisAccess,
    deepAnalysisUsesLeft,
    deepAnalysisTotalFreeUses,
    timelineSpreading,
    timelinePromptVisible,
    setNameDraft,
    saveProfileName,
    pickAvatar,
    clearAvatar,
    setThemeMode: updateThemeMode,
    setHealthStepsEnabled: updateHealthStepsEnabled,
    createTelegramLinkCode,
    openTelegramLinkFlow,
    setType,
    setSource,
    setTitle,
    setAuthorOrArtist,
    addItem,
    saveEdit,
    startEdit,
    removeItem,
    runFakeImport,
    importFromScreenshot,
    confirmPendingImageImport,
    cancelPendingImageImport,
    removePendingImageItem,
    selectPendingImageItem: setSelectedPendingImageId,
    updatePendingImageItem,
    assignPendingImageItemThisMonth: (id: string) => assignPendingImageItemTime(id, "this_month"),
    assignPendingImageItemLastMonth: (id: string) => assignPendingImageItemTime(id, "last_month"),
    assignPendingImageItemLast6Months: (id: string) => assignPendingImageItemTime(id, "last_6_months"),
    assignPendingImageItemThisYear: (id: string) => assignPendingImageItemTime(id, "this_year"),
    assignPendingImageItemVeryOld: (id: string) => assignPendingImageItemTime(id, "very_old"),
    setSpotifyUrl,
    importSpotifyLink,
    connectSpotifyAccount,
    refreshSpotifyConnection: () => refreshSpotifyConnection(true),
    loadSpotifyPlaylists: loadSpotifyPlaylistsList,
    importSpotifyLikedSongs: () => importSpotifyAccountSource({ mode: "liked" }, "liked songs"),
    importSpotifyRecentlyPlayed: () =>
      importSpotifyAccountSource({ mode: "recently_played" }, "recently played"),
    importSpotifyPlaylist: (playlistId: string, playlistName: string) =>
      importSpotifyAccountSource({ mode: "playlist", playlistId }, `playlist ${playlistName}`),
    setLastfmUsername,
    setLetterboxdProfile,
    importLastfmProfileByUsername,
    importLetterboxdPublicProfile,
    disconnectLastfmSource: (deleteContent = false) => disconnectProfileSource("lastfm", deleteContent),
    disconnectLetterboxdSource: (deleteContent = false) => disconnectProfileSource("letterboxd", deleteContent),
    disconnectSpotifySource,
    importLivelibFile: () => importPlatformFile("livelib"),
    importGoodreadsFile: () => importPlatformFile("goodreads"),
    importLetterboxdFile: () => importPlatformFile("letterboxd"),
    importLastfmFile: () => importPlatformFile("lastfm"),
    importKinopoiskFile: () => importPlatformFile("kinopoisk"),
    importMubiFile: () => importPlatformFile("mubi"),
    cancelFileImportOpening,
    cancelEdit: () => {
      setEditingId(null);
      resetForm();
      setTab("library");
    },
    setTypeFilter: (value: TypeFilter) => {
      setTypeFilter(value);
      setSelectedId(null);
    },
    setSourceFilter: (value: SourceFilter) => {
      setSourceFilter(value);
      setSelectedId(null);
    },
    setTimeQualityFilter: (value: TimeQualityFilter) => {
      setTimeQualityFilter(value);
      setSelectedId(null);
    },
    setSelectedId,
    runFakeAnalysis,
    runDeepAnalysis,
    spreadIntoThisMonth: () => spreadVisibleUndatedItems("this_month"),
    spreadIntoLastMonth: () => spreadVisibleUndatedItems("last_month"),
    spreadIntoLast6Months: () => spreadVisibleUndatedItems("last_6_months"),
    spreadIntoThisYear: () => spreadVisibleUndatedItems("this_year"),
    spreadIntoVeryOld: () => spreadVisibleUndatedItems("very_old"),
    assignItemTime: (itemId: string, preset: TimelineSpreadPreset) => assignTimelineToItem(itemId, preset),
    assignSelectedToThisMonth: () => selectedId && assignTimelineToItem(selectedId, "this_month"),
    assignSelectedToLastMonth: () => selectedId && assignTimelineToItem(selectedId, "last_month"),
    assignSelectedToLast6Months: () => selectedId && assignTimelineToItem(selectedId, "last_6_months"),
    assignSelectedToThisYear: () => selectedId && assignTimelineToItem(selectedId, "this_year"),
    assignSelectedToVeryOld: () => selectedId && assignTimelineToItem(selectedId, "very_old"),
    moveItemsToDate,
    dismissTimelinePrompt: () => setTimelinePromptVisible(false),
    promptTimelinePlacement,
    openAnalysisResult: setAnalysisResult,
    showOnboarding,
    onboardingStep,
    onboardingVariant,
    nextOnboardingStep,
    skipOnboarding,
    finishOnboarding,
    replayOnboarding,
  };
}

function hasValidCustomName(user: TgUser | null) {
  const normalized = getDisplayName(user).trim().toLowerCase();
  return normalized !== "друг" && normalized !== "ios friend" && normalized !== "ios друг";
}

import { useTimeline } from "./useTimeline";
import { useLibraryImports } from "./useLibraryImports";
import type { ConnectedSourceState, PendingImageItem, SpotifyPlaylist } from "./importTypes";
import type { DateInsight, TimelineSpreadPreset } from "./timelineTypes";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Linking } from "react-native";
import QRCode from "qrcode";
import { Dispatch, SetStateAction, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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

function useOnboarding(library: LibraryItem[]) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingVariant, setOnboardingVariant] = useState<"fresh" | "linked">("fresh");

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

  return {
    showOnboarding, onboardingStep, onboardingVariant,
    setShowOnboarding, setOnboardingStep, setOnboardingVariant,
    finishOnboarding, nextOnboardingStep, skipOnboarding, replayOnboarding,
  };
}

function useTelegramLink(deps: {
  apiToken: string | null;
  fireAnalytics: (event: string, properties?: Record<string, unknown>) => void;
  setToastMessage: (message: string | null) => void;
}) {
  const { apiToken, fireAnalytics, setToastMessage } = deps;
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

  return {
    telegramLink, telegramLinkLoading, telegramLinkStatus, telegramLinkQrDataUrl,
    telegramLinkWasLinkedRef,
    setTelegramLink, setTelegramLinkStatus, setTelegramLinkQrDataUrl,
    createTelegramLinkCode, openTelegramLinkFlow,
  };
}

export function useEveryYouApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [user, setUser] = useState<TgUser | null>({ first_name: "ios", last_name: "друг" });
  const [type, setType] = useState<ContentType | "">("");
  const [source, setSource] = useState<SourceType | "">("");
  const [title, setTitle] = useState("");
  const [authorOrArtist, setAuthorOrArtist] = useState("");
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const onboarding = useOnboarding(library);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [timeQualityFilter, setTimeQualityFilter] = useState<TimeQualityFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [phIdx, setPhIdx] = useState(0);
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
  const telegram = useTelegramLink({ apiToken, fireAnalytics, setToastMessage });
  const [dailySteps, setDailySteps] = useState<DailyStepEntry[]>([]);
  const [healthStepsEnabled, setHealthStepsEnabled] = useState(false);
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
          imports.setConnectedSources(nextSources);
          if (nextSources.lastfm?.profile) {
            imports.setLastfmUsername(nextSources.lastfm.profile);
          }
          if (nextSources.letterboxd?.profile) {
            imports.setLetterboxdProfile(nextSources.letterboxd.profile);
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
          telegram.setTelegramLink(linkStatus);
          telegram.telegramLinkWasLinkedRef.current = linkStatus.linked;
        }
        if (
          remoteLibrary.length === 0 &&
          storedLibrary.length === 0 &&
          linkStatus &&
          !linkStatus.linked &&
          telegram.telegramLinkWasLinkedRef.current
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
      imports.setImportedCount(storedImportCount);
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
        onboarding.setOnboardingVariant(nextLibrary.length > 0 ? "linked" : "fresh");
        onboarding.setShowOnboarding(true);
        onboarding.setOnboardingStep(0);
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
        telegram.setTelegramLink(status);
        telegram.telegramLinkWasLinkedRef.current = status.linked;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [apiToken]);

  useEffect(() => {
    if (!apiToken || telegram.telegramLink.linked || !telegram.telegramLink.code) return;

    let cancelled = false;
    const intervalId = setInterval(async () => {
      try {
        const status = await fetchTelegramLinkStatus(apiToken);
        if (cancelled) return;

        const justLinked = status.linked && !telegram.telegramLinkWasLinkedRef.current;
        telegram.telegramLinkWasLinkedRef.current = status.linked;
        telegram.setTelegramLink(status);

        if (justLinked) {
          telegram.setTelegramLinkStatus("готово — Telegram и приложение теперь связаны");
          setToastMessage("Telegram подключен");
          await refreshLinkedLibrary(apiToken);
          if (cancelled) return;

          try {
            const spotifyStatus = await fetchSpotifyConnectionStatus(apiToken);
            if (!cancelled) {
              imports.setSpotifyConnected(spotifyStatus.connected);
              imports.setSpotifyProfileName(spotifyStatus.profile?.displayName ?? null);
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
  }, [apiToken, telegram.telegramLink.code, telegram.telegramLink.linked]);

  useEffect(() => {
    if (!telegram.telegramLink.code) {
      telegram.setTelegramLinkQrDataUrl(null);
      return;
    }

    const deepLink = `https://t.me/every_you_bot?startapp=link_${telegram.telegramLink.code}`;
    QRCode.toDataURL(deepLink, {
      margin: 1,
      width: 480,
      color: { dark: "#111111", light: "#FFFFFF" },
    })
      .then((uri: string) => telegram.setTelegramLinkQrDataUrl(uri))
      .catch(() => telegram.setTelegramLinkQrDataUrl(null));
  }, [telegram.telegramLink.code]);

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
        imports.setSpotifyUrl(normalized);
        imports.setSpotifyStatus("получили ссылку из share, можно импортировать");
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
          imports.setSpotifyUrl(sharedUrl);
          imports.setSpotifyStatus("получили ссылку из share, можно импортировать");
          setTab("add");
          setToastMessage("ссылка открыта в everyyou");
          return;
        }

        if (sharedType === "music" || sharedType === "book" || sharedType === "movie") {
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
        imports.setSpotifyConnected(status.connected);
        imports.setSpotifyProfileName(status.profile?.displayName ?? null);
      } catch {
        if (cancelled) return;
        imports.setSpotifyConnected(false);
        imports.setSpotifyProfileName(null);
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
    const byType: Record<ContentType, number> = { music: 0, book: 0, movie: 0 };
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

  const timeline = useTimeline({ apiToken, library, setLibrary, setSyncStatus, setSyncMessage, setToastMessage, setTab, undatedVisibleLibrary });
  const imports = useLibraryImports({ apiToken, library, setLibrary, setSelectedId, setSyncStatus, setSyncMessage, setToastMessage, setTab, timeline, loaded, fireAnalytics });

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
    () => imports.pendingImageItems.find((item) => item.id === imports.selectedPendingImageId) ?? null,
    [imports.pendingImageItems, imports.selectedPendingImageId]
  );

  function resetForm() {
    setType("");
    setSource("");
    setTitle("");
    setAuthorOrArtist("");
    imports.setSpotifyUrl("");
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
            : `в библиотеке ${total} айтемов. музыка: ${byType.music}, книги: ${byType.book}, фильмы: ${byType.movie}.`,
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
    if (apiToken) await saveSharedProfile(apiToken, { displayName: nameDraft || null, avatarUrl: avatarUri, themeMode: nextMode });
    setThemeMode(nextMode);
    setToastMessage(nextMode === "dark" ? "включили темную тему" : "вернули светлую тему");
    fireAnalytics("theme_changed", { mode: nextMode });
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
    telegramLink: telegram.telegramLink,
    telegramLinkLoading: telegram.telegramLinkLoading,
    telegramLinkStatus: telegram.telegramLinkStatus,
    telegramLinkQrDataUrl: telegram.telegramLinkQrDataUrl,
    namePlaceholder,
    syncStatus,
    syncMessage,
    toastMessage,
    editingId,
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
    timelineSpreading: timeline.timelineSpreading,
    timelinePromptVisible: timeline.timelinePromptVisible,
    setNameDraft,
    saveProfileName,
    pickAvatar,
    clearAvatar,
    setThemeMode: updateThemeMode,
    setHealthStepsEnabled: updateHealthStepsEnabled,
    createTelegramLinkCode: telegram.createTelegramLinkCode,
    openTelegramLinkFlow: telegram.openTelegramLinkFlow,
    setType,
    setSource,
    setTitle,
    setAuthorOrArtist,
    addItem,
    saveEdit,
    startEdit,
    removeItem,
    runFakeImport: imports.runFakeImport,
    importFromScreenshot: imports.importFromScreenshot,
    confirmPendingImageImport: imports.confirmPendingImageImport,
    cancelPendingImageImport: imports.cancelPendingImageImport,
    removePendingImageItem: imports.removePendingImageItem,
    selectPendingImageItem: imports.setSelectedPendingImageId,
    updatePendingImageItem: imports.updatePendingImageItem,
    assignPendingImageItemThisMonth: (id: string) => imports.assignPendingImageItemTime(id, "this_month"),
    assignPendingImageItemLastMonth: (id: string) => imports.assignPendingImageItemTime(id, "last_month"),
    assignPendingImageItemLast6Months: (id: string) => imports.assignPendingImageItemTime(id, "last_6_months"),
    assignPendingImageItemThisYear: (id: string) => imports.assignPendingImageItemTime(id, "this_year"),
    assignPendingImageItemVeryOld: (id: string) => imports.assignPendingImageItemTime(id, "very_old"),
    setSpotifyUrl: imports.setSpotifyUrl,
    importSpotifyLink: imports.importSpotifyLink,
    connectSpotifyAccount: imports.connectSpotifyAccount,
    refreshSpotifyConnection: () => imports.refreshSpotifyConnection(true),
    loadSpotifyPlaylists: imports.loadSpotifyPlaylistsList,
    importSpotifyLikedSongs: () => imports.importSpotifyAccountSource({ mode: "liked" }, "liked songs"),
    importSpotifyRecentlyPlayed: () =>
      imports.importSpotifyAccountSource({ mode: "recently_played" }, "recently played"),
    importSpotifyPlaylist: (playlistId: string, playlistName: string) =>
      imports.importSpotifyAccountSource({ mode: "playlist", playlistId }, `playlist ${playlistName}`),
    setLastfmUsername: imports.setLastfmUsername,
    setLetterboxdProfile: imports.setLetterboxdProfile,
    importProfileSource: imports.importProfileSource,
    disconnectLastfmSource: (deleteContent = false) => imports.disconnectProfileSource("lastfm", deleteContent),
    disconnectLetterboxdSource: (deleteContent = false) => imports.disconnectProfileSource("letterboxd", deleteContent),
    disconnectSpotifySource: imports.disconnectSpotifySource,
    importLivelibFile: () => imports.importPlatformFile("livelib"),
    importGoodreadsFile: () => imports.importPlatformFile("goodreads"),
    importLetterboxdFile: () => imports.importPlatformFile("letterboxd"),
    importLastfmFile: () => imports.importPlatformFile("lastfm"),
    importKinopoiskFile: () => imports.importPlatformFile("kinopoisk"),
    importMubiFile: () => imports.importPlatformFile("mubi"),
    cancelFileImportOpening: imports.cancelFileImportOpening,
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
    spreadIntoThisMonth: () => timeline.spreadVisibleUndatedItems("this_month"),
    spreadIntoLastMonth: () => timeline.spreadVisibleUndatedItems("last_month"),
    spreadIntoLast6Months: () => timeline.spreadVisibleUndatedItems("last_6_months"),
    spreadIntoThisYear: () => timeline.spreadVisibleUndatedItems("this_year"),
    spreadIntoVeryOld: () => timeline.spreadVisibleUndatedItems("very_old"),
    assignItemTime: (itemId: string, preset: TimelineSpreadPreset) => timeline.assignTimelineToItem(itemId, preset),
    assignSelectedToThisMonth: () => selectedId && timeline.assignTimelineToItem(selectedId, "this_month"),
    assignSelectedToLastMonth: () => selectedId && timeline.assignTimelineToItem(selectedId, "last_month"),
    assignSelectedToLast6Months: () => selectedId && timeline.assignTimelineToItem(selectedId, "last_6_months"),
    assignSelectedToThisYear: () => selectedId && timeline.assignTimelineToItem(selectedId, "this_year"),
    assignSelectedToVeryOld: () => selectedId && timeline.assignTimelineToItem(selectedId, "very_old"),
    moveItemsToDate: timeline.moveItemsToDate,
    dismissTimelinePrompt: () => timeline.setTimelinePromptVisible(false),
    promptTimelinePlacement: timeline.promptTimelinePlacement,
    openAnalysisResult: setAnalysisResult,
    showOnboarding: onboarding.showOnboarding,
    onboardingStep: onboarding.onboardingStep,
    onboardingVariant: onboarding.onboardingVariant,
    nextOnboardingStep: onboarding.nextOnboardingStep,
    skipOnboarding: onboarding.skipOnboarding,
    finishOnboarding: onboarding.finishOnboarding,
    replayOnboarding: onboarding.replayOnboarding,
  };
}

function hasValidCustomName(user: TgUser | null) {
  const normalized = getDisplayName(user).trim().toLowerCase();
  return normalized !== "друг" && normalized !== "ios friend" && normalized !== "ios друг";
}

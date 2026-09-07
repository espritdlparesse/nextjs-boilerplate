import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Dispatch, SetStateAction } from "react";
import {
  ensureGuestSession,
  fetchBackendHealth,
  fetchConnectedSources,
  fetchItems,
  fetchSharedProfile,
  fetchTelegramLinkStatus,
  getStoredAvatarUri,
  getStoredGuestName,
  getStoredOnboardingDone,
  getStoredThemeMode,
  resetGuestSession,
} from "../lib/api";
import {
  getDisplayName,
  normalizeLibrary,
  LEGACY_ANALYSIS_KEYS,
  LEGACY_IMPORT_KEYS,
  LEGACY_LIBRARY_KEYS,
  STORAGE_KEY_ANALYSIS,
  STORAGE_KEY_DAILY_STEPS,
  STORAGE_KEY_HEALTH_STEPS_ENABLED,
  STORAGE_KEY_IMPORT,
  STORAGE_KEY_LIBRARY,
  type AnalysisRun,
  type DailyStepEntry,
  type LibraryItem,
  type ThemeMode,
  type TgUser,
} from "../shared/everyyou/domain";
import { hasValidCustomName, isGuestSessionError, loadJSON, loadNumber, splitDisplayName } from "./appStorage";
import type { SyncStatus, TelegramLinkState } from "./appTypes";
import type { ConnectedSourceState } from "./importTypes";

export type StoredAppState = {
  library: LibraryItem[];
  importedCount: number;
  analysisHistory: AnalysisRun[];
  guestName: string;
  avatarUri: string | null;
  themeMode: ThemeMode;
  onboardingDone: boolean;
  dailySteps: DailyStepEntry[];
  healthStepsEnabled: boolean;
};

export type RemoteAppState = {
  library: LibraryItem[];
  user: TgUser;
  apiToken: string | null;
  syncStatus: SyncStatus;
  syncMessage: string;
  avatarUri: string | null;
  themeMode: ThemeMode;
  telegramLink: TelegramLinkState | null;
  connectedSources: ConnectedSourceState | null;
};

export async function readStoredAppState(): Promise<StoredAppState> {
  return {
    library: normalizeLibrary(await loadJSON<unknown[]>(STORAGE_KEY_LIBRARY, LEGACY_LIBRARY_KEYS, [])),
    importedCount: await loadNumber(STORAGE_KEY_IMPORT, LEGACY_IMPORT_KEYS),
    analysisHistory: await loadJSON<AnalysisRun[]>(STORAGE_KEY_ANALYSIS, LEGACY_ANALYSIS_KEYS, []),
    guestName: await getStoredGuestName("ios friend"),
    avatarUri: await getStoredAvatarUri(),
    themeMode: await getStoredThemeMode(),
    onboardingDone: await getStoredOnboardingDone(),
    dailySteps: await loadJSON<DailyStepEntry[]>(STORAGE_KEY_DAILY_STEPS, [], []),
    healthStepsEnabled: (await AsyncStorage.getItem(STORAGE_KEY_HEALTH_STEPS_ENABLED)) === "true",
  };
}

async function openSession(guestName: string) {
  const health = await fetchBackendHealth();
  if (!health.env.everyyouAppAuthSecret) {
    throw new Error("backend reachable, but EVERYYOU_APP_AUTH_SECRET is missing");
  }

  const session = await ensureGuestSession(guestName);
  try {
    return { session, library: await fetchItems(session.token) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!isGuestSessionError(message)) throw error;
    await resetGuestSession();
    const retried = await ensureGuestSession(guestName);
    return { session: retried, library: await fetchItems(retried.token) };
  }
}

async function readConnectedSources(token: string): Promise<ConnectedSourceState | null> {
  try {
    const sources = await fetchConnectedSources(token);
    const state: ConnectedSourceState = { lastfm: null, letterboxd: null };
    for (const source of sources.sources) {
      if (source.platform !== "lastfm" && source.platform !== "letterboxd") continue;
      state[source.platform] = { profile: source.profile, lastSyncedAt: source.lastSyncedAt };
    }
    return state;
  } catch {
    return null;
  }
}

async function readTelegramLink(token: string): Promise<TelegramLinkState | null> {
  try {
    return await fetchTelegramLinkStatus(token);
  } catch {
    return null;
  }
}

async function applySharedProfile(token: string, base: RemoteAppState) {
  try {
    const profile = await fetchSharedProfile(token);
    if (profile.displayName) base.user = splitDisplayName(profile.displayName);
    if (profile.avatarUrl) base.avatarUri = profile.avatarUrl;
    base.themeMode = profile.themeMode;
  } catch {
    return;
  }
}

function offlineState(stored: StoredAppState, error: unknown): RemoteAppState {
  return {
    library: stored.library,
    user: splitDisplayName(stored.guestName),
    apiToken: null,
    syncStatus: "offline",
    syncMessage: error instanceof Error ? error.message : "backend недоступен",
    avatarUri: stored.avatarUri,
    themeMode: stored.themeMode,
    telegramLink: null,
    connectedSources: null,
  };
}

export async function fetchRemoteAppState(
  stored: StoredAppState,
  wasLinked: boolean
): Promise<RemoteAppState> {
  try {
    const { session, library: remoteLibrary } = await openSession(stored.guestName);
    const keepLocal = remoteLibrary.length === 0 && stored.library.length > 0;
    const telegramLink = await readTelegramLink(session.token);
    const lostLink =
      remoteLibrary.length === 0 && stored.library.length === 0 && telegramLink && !telegramLink.linked && wasLinked;
    const state: RemoteAppState = {
      library: keepLocal ? stored.library : remoteLibrary,
      user: splitDisplayName(session.name ?? stored.guestName),
      apiToken: session.token,
      syncStatus: "online",
      syncMessage: lostLink
        ? "похоже, нужно заново связать телеграм и айфон"
        : keepLocal
          ? "пока показываем сохраненную библиотеку"
          : "данные синхронизируются с сервером",
      avatarUri: stored.avatarUri,
      themeMode: stored.themeMode,
      telegramLink,
      connectedSources: await readConnectedSources(session.token),
    };
    await applySharedProfile(session.token, state);
    return state;
  } catch (error) {
    return offlineState(stored, error);
  }
}

export async function refreshLinkedLibrary(
  token: string,
  apply: {
    setLibrary: Dispatch<SetStateAction<LibraryItem[]>>;
    setSyncStatus: (status: SyncStatus) => void;
    setSyncMessage: (message: string) => void;
  },
  attempts = 4
) {
  const { setLibrary, setSyncStatus, setSyncMessage } = apply;
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

export type BootstrapSinks = {
  setLibrary: (library: LibraryItem[]) => void;
  setImportedCount: (count: number) => void;
  setAnalysisHistory: (history: AnalysisRun[]) => void;
  setUser: (user: TgUser) => void;
  setNameDraft: (name: string) => void;
  setAvatarUri: (uri: string | null) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setDailySteps: (steps: DailyStepEntry[]) => void;
  setHealthStepsEnabled: (enabled: boolean) => void;
  setApiToken: (token: string | null) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setSyncMessage: (message: string) => void;
  setConnectedSources: (sources: ConnectedSourceState) => void;
  setLastfmUsername: (profile: string) => void;
  setLetterboxdProfile: (profile: string) => void;
  setTelegramLink: (link: TelegramLinkState) => void;
  telegramLinkWasLinkedRef: { current: boolean };
  onboarding: {
    setOnboardingVariant: (variant: "fresh" | "linked") => void;
    setShowOnboarding: (visible: boolean) => void;
    setOnboardingStep: (step: number) => void;
  };
  setLoaded: (loaded: boolean) => void;
};

function applyConnectedSources(sources: ConnectedSourceState, sinks: BootstrapSinks) {
  sinks.setConnectedSources(sources);
  if (sources.lastfm?.profile) sinks.setLastfmUsername(sources.lastfm.profile);
  if (sources.letterboxd?.profile) sinks.setLetterboxdProfile(sources.letterboxd.profile);
}

export function applyBootstrapState(stored: StoredAppState, remote: RemoteAppState, sinks: BootstrapSinks) {
  sinks.setLibrary(remote.library);
  sinks.setImportedCount(stored.importedCount);
  sinks.setAnalysisHistory(stored.analysisHistory);
  sinks.setUser(remote.user);
  sinks.setNameDraft(hasValidCustomName(remote.user) ? getDisplayName(remote.user) : "");
  sinks.setAvatarUri(remote.avatarUri);
  sinks.setThemeMode(remote.themeMode);
  sinks.setDailySteps(stored.dailySteps);
  sinks.setHealthStepsEnabled(stored.healthStepsEnabled);
  sinks.setApiToken(remote.apiToken);
  sinks.setSyncStatus(remote.syncStatus);
  sinks.setSyncMessage(remote.syncMessage);
  if (remote.connectedSources) applyConnectedSources(remote.connectedSources, sinks);
  if (remote.telegramLink) {
    sinks.setTelegramLink(remote.telegramLink);
    sinks.telegramLinkWasLinkedRef.current = remote.telegramLink.linked;
  }
  if (!stored.onboardingDone) {
    sinks.onboarding.setOnboardingVariant(remote.library.length > 0 ? "linked" : "fresh");
    sinks.onboarding.setShowOnboarding(true);
    sinks.onboarding.setOnboardingStep(0);
  }
  sinks.setLoaded(true);
}

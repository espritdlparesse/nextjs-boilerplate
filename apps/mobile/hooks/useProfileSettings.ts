import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  clearStoredAvatarUri,
  saveSharedProfile,
  setStoredAvatarUri,
  setStoredGuestName,
  setStoredThemeMode,
  uploadSharedProfileAvatar as uploadAvatar,
} from "../lib/api";
import { clampText, type Tab, type TgUser, type ThemeMode } from "../shared/everyyou/domain";
import { splitDisplayName } from "./appStorage";
import { AVATAR_EMOJIS, avatarEmojiAt, randomAvatarEmojiIndex } from "../../../lib/avatarEmojis";

export function useProfileSettings(deps: {
  apiToken: string | null;
  loaded: boolean;
  tab: Tab;
  setUser: (user: TgUser) => void;
  setToastMessage: (message: string | null) => void;
  fireAnalytics: (event: string, properties?: Record<string, unknown>) => void;
}) {
  const { apiToken, loaded, tab, setUser, setToastMessage, fireAnalytics } = deps;
  const [nameDraft, setNameDraft] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [headerAvatarEmojiIndex, setHeaderAvatarEmojiIndex] = useState(randomAvatarEmojiIndex);

  useEffect(() => {
    if (!loaded || avatarUri || tab !== "home") return;
    setHeaderAvatarEmojiIndex((current) => (current + 1) % AVATAR_EMOJIS.length);
  }, [tab, avatarUri, loaded]);

  async function pushProfile(patch: { displayName?: string | null; avatarUrl?: string | null; themeMode?: ThemeMode }) {
    if (!apiToken) return;
    await saveSharedProfile(apiToken, {
      displayName: patch.displayName === undefined ? nameDraft || null : patch.displayName,
      avatarUrl: patch.avatarUrl === undefined ? avatarUri : patch.avatarUrl,
      themeMode: patch.themeMode ?? themeMode,
    });
  }

  async function saveProfileName() {
    const normalized = clampText(nameDraft);
    if (!normalized) return;

    await setStoredGuestName(normalized);
    await pushProfile({ displayName: normalized });
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
    const picked = result.assets[0].uri;
    const nextAvatarUri = apiToken ? await uploadAvatar(apiToken, picked) : picked;
    await setStoredAvatarUri(nextAvatarUri);
    setAvatarUri(nextAvatarUri);
    setToastMessage("аватар обновили");
    fireAnalytics("avatar_updated");
  }

  async function clearAvatar() {
    await clearStoredAvatarUri();
    await pushProfile({ avatarUrl: null });
    setAvatarUri(null);
    setToastMessage("аватар убрали");
    fireAnalytics("avatar_cleared");
  }

  async function updateThemeMode(nextMode: ThemeMode) {
    await setStoredThemeMode(nextMode);
    await pushProfile({ themeMode: nextMode });
    setThemeMode(nextMode);
    setToastMessage(nextMode === "dark" ? "включили темную тему" : "вернули светлую тему");
    fireAnalytics("theme_changed", { mode: nextMode });
  }

  return {
    nameDraft, avatarUri, themeMode,
    headerAvatarEmoji: avatarEmojiAt(headerAvatarEmojiIndex),
    setNameDraft, setAvatarUri, setThemeMode,
    saveProfileName, pickAvatar, clearAvatar, updateThemeMode,
  };
}

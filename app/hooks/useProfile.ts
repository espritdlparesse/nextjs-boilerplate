import type { Tab, VibeDuel, VibeDuelVariant, ItemType, ItemSource, ImportedItem, DbItem, ImportPlatform, ImportService } from "@/app/types";
import { apiFetch, getTgInitData, safeJson } from "@/app/apiFetch";
import { useEffect, useMemo, useRef, useState } from "react";

export function useProfile(deps: { loadLibrary: () => void; setLibraryError: (message: string) => void }) {
  const { loadLibrary, setLibraryError } = deps;
  const [telegramLinkCode, setTelegramLinkCode] = useState("");
  const [telegramLinkLoading, setTelegramLinkLoading] = useState(false);
  const [telegramLinkStatus, setTelegramLinkStatus] = useState("");
  const [telegramLinkSuccess, setTelegramLinkSuccess] = useState(false);
  const [showTelegramManualLink, setShowTelegramManualLink] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [editingProfileName, setEditingProfileName] = useState(false);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileTheme, setProfileTheme] = useState<"light" | "dark">("light");
  const [profileSaving, setProfileSaving] = useState(false);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);

  async function loadProfileSettings() {
    try {
      const { res, json } = await apiFetch("/api/v2/profile");
      if (!res.ok) return;
      const name = typeof json?.displayName === "string" ? json.displayName : "";
      setProfileName(name);
      setProfileNameDraft(name);
      setEditingProfileName(!name);
      setProfileAvatarUrl(typeof json?.avatarUrl === "string" ? json.avatarUrl : null);
      setProfileTheme(json?.themeMode === "dark" ? "dark" : "light");
    } catch {}
  }

  async function saveProfileSettings(next: { displayName?: string; avatarUrl?: string | null; themeMode?: "light" | "dark" }) {
    setProfileSaving(true);
    try {
      const { res, json } = await apiFetch("/api/v2/profile", { method: "PUT", body: JSON.stringify({ displayName: "displayName" in next ? next.displayName : profileName, avatarUrl: "avatarUrl" in next ? next.avatarUrl : profileAvatarUrl, themeMode: "themeMode" in next ? next.themeMode : profileTheme, }),
      });
      if (!res.ok) throw new Error(json?.error ?? "не удалось сохранить профиль");
      setProfileName(json?.displayName ?? "");
      setProfileNameDraft(json?.displayName ?? "");
      setProfileAvatarUrl(json?.avatarUrl ?? null);
      setProfileTheme(json?.themeMode === "dark" ? "dark" : "light");
      return true;
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "не удалось сохранить профиль");
      return false;
    } finally { setProfileSaving(false); }
  }

  async function uploadProfileAvatar(file: File) {
    setProfileSaving(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { res, json } = await apiFetch("/api/v2/profile/avatar", { method: "POST", body: form });
      if (!res.ok) throw new Error(json?.error ?? "не удалось загрузить аватар");
      setProfileAvatarUrl(json?.avatarUrl ?? null);
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "не удалось загрузить аватар");
    } finally { setProfileSaving(false); }
  }

  async function linkMobileAccount(prefilledCode?: string) {
    const code = (prefilledCode ?? telegramLinkCode).trim().toUpperCase();
    if (!code) {
      setTelegramLinkStatus("введи код из мобильного приложения");
      setTelegramLinkSuccess(false);
      return;
    }

    setTelegramLinkLoading(true);
    setTelegramLinkStatus("");
    setTelegramLinkSuccess(false);
    try {
      const { res, json } = await apiFetch("/api/telegram/link", { method: "POST", body: JSON.stringify({ code }) });
      if (!res.ok) {
        setTelegramLinkStatus(json?.error ?? "не удалось связать аккаунты");
        return;
      }
      setTelegramLinkStatus("готово — Telegram и мобильное приложение теперь связаны");
      setTelegramLinkSuccess(true);
      setTelegramLinkCode("");
      await loadLibrary();
    } catch (e: any) {
      setTelegramLinkStatus(e?.message ?? "не удалось связать аккаунты");
    } finally {
      setTelegramLinkLoading(false);
    }
  }

  return {
    telegramLinkCode, telegramLinkLoading, telegramLinkStatus, telegramLinkSuccess,
    showTelegramManualLink, profileName, profileNameDraft, editingProfileName,
    profileAvatarUrl, profileTheme, profileSaving, profileAvatarInputRef,
    setTelegramLinkCode, setTelegramLinkStatus, setTelegramLinkSuccess, setShowTelegramManualLink,
    setProfileNameDraft, setEditingProfileName, setProfileTheme, setProfileName,
    loadProfileSettings, saveProfileSettings, uploadProfileAvatar, linkMobileAccount,
  };
}

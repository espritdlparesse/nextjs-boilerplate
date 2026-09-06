"use client";
import { generateShareCard } from "@/lib/shareCard";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { isAdminTgId } from "@/lib/admins";
import { parseImportedFile } from "@/apps/mobile/lib/fileImports";
import { generateMonthlySummary } from "@/lib/monthlySummaryEngine";

type Tab = "home" | "add" | "library" | "vibe" | "profile" | "admin";

type VibeDuelVariant = {
  runId: string | null;
  summary: string;
  persona: string;
  basis: string[];
  highlights: string[];
};

type VibeDuel = { id: string; variants: VibeDuelVariant[] };

type ItemType = "music" | "book" | "movie" | "custom";
type ItemSource =
  | "spotify"
  | "goodreads"
  | "letterboxd"
  | "manual"
  | "livelib"
  | "import_spotify"
  | "import_yandex_music"
  | "import_lastfm"
  | "import_letterboxd"
  | "lastfm"
  | "kinopoisk"
  | "mubi";

type ImportedItem = {
  type: ItemType;
  source: ItemSource;
  title: string;
  creator?: string | null;
  consumedAt?: number | null;
  timeOrigin?: "exact" | "imported" | "estimated" | null;
  custom_category_id?: string | null;
  custom_category_name?: string | null;
  custom_category_emoji?: string | null;
};

type DbItem = {
  id: string | number;
  tg_user_id?: number;
  type: ItemType;
  source: ItemSource;
  title: string;
  creator?: string | null;
  created_at?: string;
  consumed_at?: string | null;
  time_origin?: "exact" | "imported" | "estimated" | null;
  custom_category_id?: string | null;
  custom_category_name?: string | null;
  custom_category_emoji?: string | null;
};

type ImportPlatform = "spotify" | "livelib" | "goodreads" | "letterboxd" | "lastfm" | "kinopoisk" | "mubi";

type ImportService = {
  id: ImportPlatform;
  title: string;
  subtitle: string;
  icon: string;
  kind: "oauth" | "csv" | "profile";
  instructions?: string[];
  actionLabel?: string;
};

function getTgInitData(): string {
  if (typeof window === "undefined") return "";
  return (window as any).Telegram?.WebApp?.initData || "";
}

// Примеры плейсхолдеров — твой вкус
const PLACEHOLDER_EXAMPLES: Record<ItemType, { title: string; creator: string }[]> = {
  movie: [
    { title: "Трудности перевода", creator: "София Коппола" },
    { title: "Крёстный отец", creator: "Фрэнсис Форд Коппола" },
    { title: "Мария", creator: "Пабло Ларраин" },
  ],
  music: [
    { title: "Bloodbuzz Ohio", creator: "The National" },
    { title: "Apartment Story", creator: "The National" },
    { title: "Sorrow", creator: "The National" },
  ],
  book: [
    { title: "Котлован", creator: "Андрей Платонов" },
    { title: "Чевенгур", creator: "Андрей Платонов" },
    { title: "Счастливая Москва", creator: "Андрей Платонов" },
  ],
  custom: [
    { title: "название", creator: "автор / бренд" },
  ],
};

function useAnimatedPlaceholder(type: ItemType, field: "title" | "creator") {
  const examples = PLACEHOLDER_EXAMPLES[type];
  const [idx, setIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState<"typing" | "pause" | "erasing">("typing");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIdx(0);
      setDisplayed("");
      setPhase("typing");
    }, 0);
    return () => clearTimeout(timeout);
  }, [type]);

  useEffect(() => {
    const target = examples[idx][field];
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === "typing") {
      if (displayed.length < target.length) {
        timeout = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 55);
      } else {
        timeout = setTimeout(() => setPhase("pause"), 1800);
      }
    } else if (phase === "pause") {
      timeout = setTimeout(() => setPhase("erasing"), 400);
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 28);
      } else {
        timeout = setTimeout(() => {
          setIdx((i) => (i + 1) % examples.length);
          setPhase("typing");
        }, 0);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayed, phase, idx, examples, field]);

  return displayed;
}

function formatShortDate(input?: string) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }).replace(" г.", "");
}

function getItemDateValue(item: DbItem) {
  return item.consumed_at || item.created_at || "";
}

function dayKey(input: string | Date) {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0, 0);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function fireAnalytics(event: string, properties?: Record<string, unknown>) {
  fetch("/api/v2/analytics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-init-data": getTgInitData(),
    },
    body: JSON.stringify({ event, properties: properties ?? {} }),
  }).catch(() => undefined);
}

async function safeJson(res: Response) {
  try { return await res.json(); } catch { return {}; }
}

const TYPE_LABELS: Record<ItemType, string> = {
  music: "музыка",
  book: "книга",
  movie: "фильм",
  custom: "своё",
};

const TYPE_ICONS: Record<ItemType, string> = {
  music: "♪",
  book: "◻",
  movie: "◈",
  custom: "✦",
};

const TYPE_COLORS: Record<ItemType, string> = {
  music: "#c8f0d8",
  book: "#fde8c8",
  movie: "#d8e8fd",
  custom: "#f0f0f0",
};

function useVibecheck() {
  const [summary, setSummary] = useState("");
  const [vibeLoading, setVibeLoading] = useState(false);
  const [vibeError, setVibeError] = useState("");
  const [vibeFeedback, setVibeFeedback] = useState<"good" | "bad" | null>(null);
  const [vibeRunId, setVibeRunId] = useState<string | null>(null);
  const [vibeDuel, setVibeDuel] = useState<VibeDuel | null>(null);
  const [vibeShownAt, setVibeShownAt] = useState<number | null>(null);
  const [shareRunId, setShareRunId] = useState<string | null>(null);
  const [mentalAge, setMentalAge] = useState("");
  const [mentalAgeLoading, setMentalAgeLoading] = useState(false);
  const [deepVibeResult, setDeepVibeResult] = useState("");
  const [deepVibeLoading, setDeepVibeLoading] = useState(false);
  const [deepVibeAccess, setDeepVibeAccess] = useState<"free"|"paid"|"forever"|"none"|null>(null);
  const [deepVibeUsesLeft, setDeepVibeUsesLeft] = useState<number|null>(null);

  async function runVibeCheck() {
    if (summary) {
      fireAnalytics("vibecheck_rerolled", {
        runId: vibeRunId,
        msSinceShown: vibeShownAt ? Date.now() - vibeShownAt : null,
        rated: vibeFeedback,
      });
    }
    setVibeLoading(true); setVibeError(""); setSummary(""); setVibeFeedback(null); setVibeRunId(null); setVibeDuel(null);
    try {
      const res = await fetch("/api/v2/analysis", {
        method: "POST",
        headers: { "x-telegram-init-data": getTgInitData(), "x-vibecheck-duel": "1" },
      });
      const json = await safeJson(res);
      if (!res.ok) {
        setVibeError(
          json?.error ??
            (res.status === 504 || res.status === 408
              ? "вайбчек не успел ответить. попробуй еще раз."
              : `не удалось провести вайбчек (код ${res.status}).`
            )
        );
        return;
      }
      const duel = json?.duel as VibeDuel | undefined;
      if (duel?.id && Array.isArray(duel.variants) && duel.variants.length >= 2) {
        setVibeDuel(duel);
        setVibeShownAt(Date.now());
        return;
      }
      setSummary(json?.summary ?? "");
      setVibeRunId(typeof json?.runId === "string" ? json.runId : null);
      setVibeShownAt(Date.now());
    } catch (e: any) {
      setVibeError(e?.message ?? "Network error");
    } finally {
      setVibeLoading(false);
    }
  }

  async function pickDuelWinner(variant: VibeDuelVariant) {
    if (!vibeDuel) return;
    const duelId = vibeDuel.id;
    setVibeDuel(null);
    setSummary(variant.summary);
    setVibeRunId(variant.runId);
    setVibeShownAt(Date.now());
    setVibeFeedback(null);
    await fetch("/api/v2/vibe-duel", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-telegram-init-data": getTgInitData() },
      body: JSON.stringify({ duelId, winnerRunId: variant.runId }),
    }).catch(() => undefined);
  }

  async function rateVibeCheck(rating: "good" | "bad") {
    if (!summary || vibeFeedback) return;
    setVibeFeedback(rating);
    await fetch("/api/v2/vibe-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-telegram-init-data": getTgInitData() },
      body: JSON.stringify({ summary, rating, runId: vibeRunId }),
    }).catch(() => undefined);
  }

  async function fetchDeepVibeAccess() {
    try {
      const res = await fetch("/api/deep-vibe", {
        headers: { "x-telegram-init-data": getTgInitData() },
      });
      const json = await safeJson(res);
      setDeepVibeAccess(json?.access ?? "none");
      setDeepVibeUsesLeft(json?.usesLeft ?? 0);
    } catch {}
  }

  async function runDeepVibe() {
    setDeepVibeLoading(true); setDeepVibeResult("");
    try {
      const res = await fetch("/api/deep-vibe", {
        method: "POST",
        headers: {
          "x-telegram-init-data": getTgInitData(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const json = await safeJson(res);
      if (json?.error === "no_access") {
        setDeepVibeAccess("none");
        setDeepVibeUsesLeft(0);
        return;
      }
      setDeepVibeResult(json?.result ?? "");
      // Обновляем счётчик после использования
      fetchDeepVibeAccess();
    } catch (e: any) {
      setDeepVibeResult("не удалось загрузить");
    } finally {
      setDeepVibeLoading(false);
    }
  }

  async function openDeepVibePurchase(product: "deep_vibe_once" | "deep_vibe_forever") {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.openInvoice) {
      alert("Покупка доступна только в Telegram");
      return;
    }
    try {
      const res = await fetch(`/api/invoice?product=${product}`, {
        headers: { "x-telegram-init-data": getTgInitData() },
      });
      const json = await safeJson(res);
      if (!json?.url) {
        alert("Не удалось создать инвойс: " + (json?.error ?? "неизвестная ошибка"));
        return;
      }
      tg.openInvoice(json.url, (status: string) => {
        if (status === "paid") {
          fetchDeepVibeAccess();
        }
      });
    } catch (e: any) {
      alert("Ошибка: " + e?.message);
    }
  }

  function buyDeepVibeOnce() { openDeepVibePurchase("deep_vibe_once"); }

  function buyDeepVibeForever() { openDeepVibePurchase("deep_vibe_forever"); }

  async function runMentalAge() {
    setMentalAgeLoading(true); setMentalAge("");
    try {
      const res = await fetch("/api/mental-age", {
        method: "POST",
        headers: { "x-telegram-init-data": getTgInitData() },
      });
      const json = await safeJson(res);
      setMentalAge(json?.result ?? "");
    } catch (e: any) {
      setMentalAge("не удалось посчитать");
    } finally {
      setMentalAgeLoading(false);
    }
  }

  return {
    summary, vibeLoading, vibeError, vibeFeedback, vibeRunId, vibeDuel, shareRunId,
    mentalAge, mentalAgeLoading, deepVibeResult, deepVibeLoading, deepVibeAccess, deepVibeUsesLeft,
    setShareRunId, setVibeRunId,
    runVibeCheck, pickDuelWinner, rateVibeCheck, fetchDeepVibeAccess,
    runDeepVibe, openDeepVibePurchase, buyDeepVibeOnce, buyDeepVibeForever, runMentalAge,
  };
}

function useProfile(deps: { loadLibrary: () => void; setLibraryError: (message: string) => void }) {
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
      const res = await fetch("/api/v2/profile", { headers: { "x-telegram-init-data": getTgInitData() } });
      const json = await safeJson(res);
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
      const res = await fetch("/api/v2/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-telegram-init-data": getTgInitData() },
        body: JSON.stringify({
          displayName: "displayName" in next ? next.displayName : profileName,
          avatarUrl: "avatarUrl" in next ? next.avatarUrl : profileAvatarUrl,
          themeMode: "themeMode" in next ? next.themeMode : profileTheme,
        }),
      });
      const json = await safeJson(res);
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
      const res = await fetch("/api/v2/profile/avatar", { method: "POST", headers: { "x-telegram-init-data": getTgInitData() }, body: form });
      const json = await safeJson(res);
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
      const res = await fetch("/api/telegram/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": getTgInitData(),
        },
        body: JSON.stringify({ code }),
      });
      const json = await safeJson(res);
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

function useLibrary(deps: {
  items: DbItem[];
  loadLibrary: () => void;
  setLibraryError: (message: string) => void;
  setLibraryLoading: (loading: boolean) => void;
}) {
  const { items, loadLibrary, setLibraryError, setLibraryLoading } = deps;
  const [libFilter, setLibFilter] = useState<ItemType | "all" | string>("all");
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDayTypeFilter, setSelectedDayTypeFilter] = useState<ItemType | "all">("all");
  const [selectedDayItems, setSelectedDayItems] = useState<Array<string | number>>([]);
  const [calendarMoveMode, setCalendarMoveMode] = useState(false);
  const [pendingMoveTargetKey, setPendingMoveTargetKey] = useState<string | null>(null);
  const [moveOriginDayKey, setMoveOriginDayKey] = useState<string | null>(null);
  const [returnDayKey, setReturnDayKey] = useState<string | null>(null);
  const [lastMovedTargetKey, setLastMovedTargetKey] = useState<string | null>(dayKey(new Date()));
  const [libraryStatus, setLibraryStatus] = useState("");
  const filteredItems = useMemo(() => {
    if (libFilter === "all") return items;
    if (libFilter === "music" || libFilter === "book" || libFilter === "movie") return items.filter(i => i.type === libFilter);
    // кастомная категория по id
    return items.filter(i => i.custom_category_id === libFilter);
  }, [items, libFilter]);

  const itemsByDay = useMemo(() => {
    const grouped = new Map<string, DbItem[]>();
    for (const item of filteredItems) {
      const dateValue = getItemDateValue(item);
      if (!dateValue) continue;
      const key = dayKey(dateValue);
      if (!key) continue;
      const bucket = grouped.get(key) ?? [];
      bucket.push(item);
      grouped.set(key, bucket);
    }
    return grouped;
  }, [filteredItems]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const startWeekday = (monthStart.getDay() + 6) % 7;
    const gridStart = addDays(monthStart, -startWeekday);
    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(gridStart, index);
      const key = dayKey(date);
      return {
        key,
        date,
        inMonth: date.getMonth() === calendarMonth.getMonth(),
        items: itemsByDay.get(key) ?? [],
      };
    });
  }, [calendarMonth, itemsByDay]);

  const selectedDay = useMemo(() => {
    if (selectedDayKey) return calendarDays.find((entry) => entry.key === selectedDayKey) ?? null;
    const todayKey = dayKey(new Date());
    return calendarDays.find((entry) => entry.key === todayKey && entry.inMonth) ?? null;
  }, [calendarDays, selectedDayKey]);

  const monthlySummary = useMemo(() => {
    const currentMonthItems = calendarDays.filter((day) => day.inMonth).flatMap((day) => day.items);
    const previousMonthStart = startOfMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
    const previousMonthItems: DbItem[] = [];
    for (const [key, dayItems] of itemsByDay.entries()) {
      const date = new Date(`${key}T00:00:00`);
      if (date.getFullYear() === previousMonthStart.getFullYear() && date.getMonth() === previousMonthStart.getMonth()) {
        previousMonthItems.push(...dayItems);
      }
    }
    return generateMonthlySummary(currentMonthItems, previousMonthItems);
  }, [calendarDays, calendarMonth, itemsByDay]);

  const selectedDayVisibleItems = useMemo(() => {
    if (!selectedDay) return [];
    const dayItems = itemsByDay.get(selectedDay.key) ?? [];
    if (selectedDayTypeFilter === "all") return dayItems;
    return dayItems.filter((item) => item.type === selectedDayTypeFilter);
  }, [itemsByDay, selectedDay, selectedDayTypeFilter]);

  const selectedDayCounts = useMemo(() => {
    const dayItems = selectedDay ? itemsByDay.get(selectedDay.key) ?? [] : [];
    return {
      all: dayItems.length,
      music: dayItems.filter((item) => item.type === "music").length,
      book: dayItems.filter((item) => item.type === "book").length,
      movie: dayItems.filter((item) => item.type === "movie").length,
    };
  }, [itemsByDay, selectedDay]);

  const pendingMoveTarget = useMemo(
    () => (pendingMoveTargetKey ? calendarDays.find((entry) => entry.key === pendingMoveTargetKey) ?? null : null),
    [calendarDays, pendingMoveTargetKey]
  );

  const returnDay = useMemo(
    () => (returnDayKey ? calendarDays.find((entry) => entry.key === returnDayKey) ?? null : null),
    [calendarDays, returnDayKey]
  );
  const lastMovedTargetDay = useMemo(
    () => (lastMovedTargetKey ? calendarDays.find((entry) => entry.key === lastMovedTargetKey) ?? null : null),
    [calendarDays, lastMovedTargetKey]
  );

  function toggleSelectedDayItem(id: string | number) {
    setSelectedDayItems((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function startMoveSelectedDayItems() {
    if (selectedDayItems.length === 0) return;
    setMoveOriginDayKey(selectedDay?.key ?? null);
    setReturnDayKey(null);
    setDayModalOpen(false);
    setPendingMoveTargetKey(null);
    setCalendarMoveMode(true);
    setLibraryStatus("выбери день, на который перенести выбранное");
  }

  function cancelMoveSelectedDayItems() {
    setCalendarMoveMode(false);
    setPendingMoveTargetKey(null);
    setSelectedDayItems([]);
    setMoveOriginDayKey(null);
    setLibraryStatus("");
  }

  async function moveSelectedItemsToDay() {
    if (!pendingMoveTarget || selectedDayItems.length === 0) return;

    const chosenItems = items.filter((item) => selectedDayItems.includes(item.id));
    if (chosenItems.length === 0) return;

    setLibraryLoading(true);
    setLibraryError("");
    try {
      for (const [index, item] of chosenItems.entries()) {
        const base = pendingMoveTarget.date;
        const sourceDate = getItemDateValue(item) ? new Date(getItemDateValue(item)) : null;
        const hours = sourceDate ? sourceDate.getHours() : 12;
        const minutes = sourceDate ? sourceDate.getMinutes() : Math.min(index * 3, 57);
        const targetDate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0).getTime();

        const res = await fetch("/api/items", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-telegram-init-data": getTgInitData(),
          },
          body: JSON.stringify({
            id: item.id,
            type: item.type,
            source: item.source,
            title: item.title,
            creator: item.creator ?? null,
            consumedAt: targetDate,
            timeOrigin: "exact",
          }),
        });
        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.error ?? "не удалось перенести дату");
      }

      await loadLibrary();
      setLibraryStatus(
        chosenItems.length === 1
          ? `да, все ок: перенесли на ${pendingMoveTarget.date.toLocaleString("ru-RU", { day: "numeric", month: "long" })}`
          : `да, все ок: перенесли ${chosenItems.length} на ${pendingMoveTarget.date.toLocaleString("ru-RU", { day: "numeric", month: "long" })}`
      );
      setReturnDayKey(moveOriginDayKey);
      setLastMovedTargetKey(pendingMoveTarget.key);
      setCalendarMoveMode(false);
      setPendingMoveTargetKey(null);
      setSelectedDayItems([]);
      setMoveOriginDayKey(null);
      setSelectedDayKey(pendingMoveTarget.key);
      setDayModalOpen(true);
    } catch (e: any) {
      setLibraryError(e?.message ?? "не удалось перенести дату");
    } finally {
      setLibraryLoading(false);
    }
  }

  function jumpBackToReturnDay() {
    if (!returnDay) return;
    setCalendarMonth(startOfMonth(returnDay.date));
    setSelectedDayKey(returnDay.key);
    setSelectedDayTypeFilter("all");
    setSelectedDayItems([]);
    setPendingMoveTargetKey(null);
    setCalendarMoveMode(false);
    setDayModalOpen(true);
    setReturnDayKey(null);
    setLibraryStatus("");
  }

  return {
    libFilter, libraryStatus, calendarMonth, selectedDayKey, dayModalOpen,
    selectedDayTypeFilter, selectedDayItems, calendarMoveMode, pendingMoveTargetKey,
    moveOriginDayKey, returnDayKey, lastMovedTargetKey,
    filteredItems, itemsByDay, calendarDays, selectedDay, monthlySummary,
    selectedDayVisibleItems, selectedDayCounts, pendingMoveTarget, returnDay, lastMovedTargetDay,
    setLibFilter, setLibraryStatus, setCalendarMonth, setSelectedDayKey, setDayModalOpen,
    setSelectedDayTypeFilter, setSelectedDayItems, setCalendarMoveMode,
    setPendingMoveTargetKey, setMoveOriginDayKey, setReturnDayKey, setLastMovedTargetKey,
    toggleSelectedDayItem, startMoveSelectedDayItems, cancelMoveSelectedDayItems,
    moveSelectedItemsToDay, jumpBackToReturnDay,
  };
}

function useImports(deps: { items: DbItem[]; loadLibrary: () => void; setTab: (tab: Tab) => void }) {
  const { items, loadLibrary, setTab } = deps;
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);
  const [spotifyProfileName, setSpotifyProfileName] = useState<string | null>(null);
  const [connectedProfiles, setConnectedProfiles] = useState<{
    lastfm: { profile: string; lastSyncedAt: string | null } | null;
    letterboxd: { profile: string; lastSyncedAt: string | null } | null;
  }>({ lastfm: null, letterboxd: null });
  const [spotifySyncing, setSpotifySyncing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const csvImportRef = useRef<HTMLInputElement | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [imported, setImported] = useState<ImportedItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [savingImported, setSavingImported] = useState(false);
  const [selectedImportService, setSelectedImportService] = useState<ImportService | null>(null);
  const [lastfmProfileInput, setLastfmProfileInput] = useState("");
  const [letterboxdProfileInput, setLetterboxdProfileInput] = useState("");
  const [yandexMusicUrl, setYandexMusicUrl] = useState("");

  async function importCsvPlatform(platform: Exclude<ImportPlatform, "spotify">, file: File) {
    setImportLoading(true);
    setImportError("");
    try {
      const text = await file.text();
      const drafts = parseImportedFile(platform, text);
      const result: ImportedItem[] = drafts.map((item) => ({
        type: item.type,
        source: platform,
        title: item.title,
        creator: item.authorOrArtist || undefined,
        consumedAt: item.consumedAt ?? undefined,
        timeOrigin: item.timeOrigin ?? undefined,
      }));
      if (result.length === 0) {
        setImportError("ничего не нашли в этом файле");
        return;
      }
      setImported(result);
      setSelectedIdx(new Set(result.map((_, i) => i)));
      setSelectedImportService(null);
    } catch (e: any) {
      setImportError(e?.message ?? "ошибка при чтении файла");
    } finally {
      setImportLoading(false);
    }
  }

  async function importYandexMusicPlaylist() {
    const url = yandexMusicUrl.trim();
    if (!url) {
      setImportError("вставь публичную ссылку на плейлист Яндекс.Музыки");
      return;
    }
    setImportLoading(true);
    setImportError("");
    setImportStatus("читаем плейлист Яндекс.Музыки...");
    try {
      const res = await fetch("/api/yandex-music/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error ?? "не удалось прочитать плейлист");
      const result: ImportedItem[] = (json?.items ?? []).map((item: any) => ({
        type: "music",
        source: "import_yandex_music",
        title: String(item.title ?? ""),
        creator: String(item.authorOrArtist ?? "") || undefined,
      })).filter((item: ImportedItem) => item.title && item.creator);
      if (!result.length) throw new Error("в этом плейлисте не нашлось доступных треков");
      setImported(result);
      setSelectedIdx(new Set(result.map((_, index) => index)));
      setYandexMusicUrl("");
      setImportStatus(`нашли ${result.length} трек(ов) — выбери, что добавить`);
    } catch (error: any) {
      setImportError(error?.message ?? "не удалось импортировать плейлист Яндекс.Музыки");
    } finally {
      setImportLoading(false);
    }
  }

  function toggleImported(i: number) {
    const next = new Set(selectedIdx);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelectedIdx(next);
  }

  async function runImport(files: File[]) {
    setImportError(""); setImportLoading(true); setImported([]); setSelectedIdx(new Set());
    try {
      const selectedFiles = files.filter((file) => file.type?.startsWith("image/")).slice(0, 10);
      const collected: ImportedItem[] = [];
      let failedCount = 0;

      for (const file of selectedFiles) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/import-image", {
          method: "POST",
          headers: { "x-telegram-init-data": getTgInitData() },
          body: form,
        });
        const json = await safeJson(res);
        if (!res.ok) {
          failedCount += 1;
          continue;
        }
        const list: ImportedItem[] = json?.items ?? [];
        if (list.length === 0) {
          failedCount += 1;
          continue;
        }
        collected.push(...list);
      }

      if (collected.length === 0) {
        setImportError("не смог разобрать контент на этих изображениях. попробуй еще раз: лучше работают скриншоты, фото книжной полки, обложек книг, альбомов и постеров.");
        return;
      }

      setImported(collected);
      setSelectedIdx(new Set(collected.map((_, i) => i)));

      if (failedCount > 0) {
        setImportError(`не всё удалось разобрать: ${failedCount} изображ. попробуй еще раз или загрузи более четкие фото/скриншоты.`);
      }
    } catch (e: any) {
      setImportError(e?.message ?? "Network error");
    } finally {
      setImportLoading(false);
    }
  }

  async function saveSelected(itemsToSave: ImportedItem[]) {
    const res = await fetch(`${window.location.origin}/api/items/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-init-data": getTgInitData(),
      },
      body: JSON.stringify({
        items: itemsToSave.map((it) => ({
          type: it.type,
          source: it.source,
          title: it.title,
          creator: it.creator ?? null,
          consumedAt: it.consumedAt ?? null,
          timeOrigin: it.timeOrigin ?? null,
        })),
      }),
      cache: "no-store",
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  }

  async function saveSelectedImported() {
    setSavingImported(true); setImportError("");
    try {
      const selected = imported.filter((_, i) => selectedIdx.has(i));
      if (selected.length === 0) { setImportError("Ничего не выбрано"); return; }
      await saveSelected(selected);
      setImported([]); setSelectedIdx(new Set());
      await loadLibrary();
      setTab("library");
    } catch (e: any) {
      setImportError(e?.message ?? "Ошибка сохранения");
    } finally {
      setSavingImported(false);
    }
  }

  function startImportService(service: ImportService) {
    if (service.id === "spotify") {
      setSelectedImportService(null);
      if (spotifyConnected) {
        syncSpotify();
      } else {
        connectSpotify();
      }
      return;
    }
    setSelectedImportService(service);
  }

  async function importLastfmProfileWeb() {
    if (!lastfmProfileInput.trim()) {
      setImportError("введи username last.fm");
      return;
    }
    setImportLoading(true);
    setImportError("");
    setImportStatus("смотрим профиль last.fm...");
    try {
      setImportStatus("тянем recent tracks...");
      const res = await fetch("/api/lastfm/import-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: lastfmProfileInput.trim() }),
      });
      const json = await safeJson(res);
      if (!res.ok) {
        setImportError(json?.error ?? "не удалось импортировать профиль last.fm");
        return;
      }
      const result: ImportedItem[] = (json?.items ?? []).map((item: any) => ({
        type: item.type,
        source: item.source ?? "lastfm",
        title: item.title,
        creator: item.authorOrArtist ?? "",
        consumedAt: typeof item.consumedAt === "number" ? item.consumedAt : undefined,
        timeOrigin: item.timeOrigin ?? undefined,
      }));
      setImported(result);
      setSelectedIdx(new Set(result.map((_: ImportedItem, i: number) => i)));
      setSelectedImportService(null);
      setConnectedProfiles((current) => ({
        ...current,
        lastfm: { profile: lastfmProfileInput.trim(), lastSyncedAt: new Date().toISOString() },
      }));
      setImportStatus(
        result.length > 0
          ? `готово: нашли ${result.length} трек(ов) в last.fm`
          : "ничего не нашли в этом профиле"
      );
    } catch (e: any) {
      setImportError(e?.message ?? "не удалось импортировать профиль last.fm");
    } finally {
      setImportLoading(false);
    }
  }

  async function importLetterboxdProfileWeb() {
    if (!letterboxdProfileInput.trim()) {
      setImportError("вставь username или ссылку на profile letterboxd");
      return;
    }
    setImportLoading(true);
    setImportError("");
    setImportStatus("смотрим public profile letterboxd...");
    try {
      setImportStatus("читаем diary и watched...");
      const res = await fetch("/api/letterboxd/import-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: letterboxdProfileInput.trim() }),
      });
      const json = await safeJson(res);
      if (!res.ok) {
        setImportError(json?.error ?? "не удалось импортировать profile Letterboxd");
        return;
      }
      const result: ImportedItem[] = (json?.items ?? []).map((item: any) => ({
        type: item.type,
        source: item.source ?? "letterboxd",
        title: item.title,
        creator: item.authorOrArtist ?? "",
        consumedAt: typeof item.consumedAt === "number" ? item.consumedAt : undefined,
        timeOrigin: item.timeOrigin ?? undefined,
      }));
      setImported(result);
      setSelectedIdx(new Set(result.map((_: ImportedItem, i: number) => i)));
      setSelectedImportService(null);
      setConnectedProfiles((current) => ({
        ...current,
        letterboxd: { profile: letterboxdProfileInput.trim(), lastSyncedAt: new Date().toISOString() },
      }));
      setImportStatus(
        result.length > 0
          ? `готово: нашли ${result.length} фильм(ов) в letterboxd`
          : "ничего не нашли в этом профиле"
      );
    } catch (e: any) {
      setImportError(e?.message ?? "не удалось импортировать profile Letterboxd");
    } finally {
      setImportLoading(false);
    }
  }

  function confirmCsvImport() {
    csvImportRef.current?.click();
  }

  async function checkSpotify() {
    try {
      const res = await fetch("/api/spotify/status", {
        headers: { "x-telegram-init-data": getTgInitData() },
      });
      const json = await safeJson(res);
      setSpotifyConnected(json?.connected ?? false);
      setSpotifyProfileName(json?.profile?.displayName ?? null);
    } catch {
      setSpotifyConnected(false);
      setSpotifyProfileName(null);
    }
  }

  async function disconnectSpotify(deleteContent = false) {
    setSpotifySyncing(true);
    setImportError("");
    setImportStatus(deleteContent ? "отвязываем spotify и чистим импорт..." : "отвязываем spotify...");
    try {
      const res = await fetch(`/api/spotify/sync?deleteContent=${deleteContent ? "1" : "0"}`, {
        method: "DELETE",
        headers: { "x-telegram-init-data": getTgInitData() },
      });
      const json = await safeJson(res);
      if (!res.ok) {
        setImportError(json?.error ?? "не удалось отвязать spotify");
        return;
      }
      setSpotifyConnected(false);
      setSpotifyProfileName(null);
      await loadLibrary();
      setImportStatus(
        deleteContent
          ? `готово: spotify отвязали и убрали ${json?.deletedItems ?? 0} айтем(ов)`
          : "готово: spotify больше не подключен"
      );
    } catch (e: any) {
      setImportError(e?.message ?? "не удалось отвязать spotify");
    } finally {
      setSpotifySyncing(false);
    }
  }

  async function connectSpotify() {
    const initData = getTgInitData();
    const url = `/api/spotify/auth?initData=${encodeURIComponent(initData)}`;
    const tg = (window as any).Telegram?.WebApp;
    tg?.openLink ? tg.openLink(url) : window.open(url, "_blank");
    // Проверяем подключение через 5 секунд
    setTimeout(() => checkSpotify(), 5000);
  }

  async function syncSpotify() {
    setSpotifySyncing(true);
    try {
      const res = await fetch("/api/spotify/sync", {
        method: "POST",
        headers: { "x-telegram-init-data": getTgInitData() },
      });
      const json = await safeJson(res);
      if (json?.ok) loadLibrary();
    } catch {}
    finally { setSpotifySyncing(false); }
  }

  async function disconnectConnectedProfile(
    platform: "lastfm" | "letterboxd",
    deleteContent = false
  ) {
    setImportLoading(true);
    setImportError("");
    setImportStatus(deleteContent ? "отвязываем источник и чистим импорт..." : "отвязываем источник...");
    try {
      const res = await fetch("/api/v2/connected-sources", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": getTgInitData(),
        },
        body: JSON.stringify({ platform, deleteContent }),
      });
      const json = await safeJson(res);
      if (!res.ok) {
        setImportError(json?.error ?? "не удалось отвязать источник");
        return;
      }
      setConnectedProfiles((current) => ({ ...current, [platform]: null }));
      if (platform === "lastfm") setLastfmProfileInput("");
      if (platform === "letterboxd") setLetterboxdProfileInput("");
      await loadLibrary();
      setImportStatus(
        deleteContent
          ? `готово: отвязали ${platform} и убрали ${json?.deletedItems ?? 0} айтем(ов)`
          : `готово: ${platform} больше не подключен`
      );
    } catch (e: any) {
      setImportError(e?.message ?? "не удалось отвязать источник");
    } finally {
      setImportLoading(false);
    }
  }

  async function loadConnectedProfiles() {
    try {
      const res = await fetch("/api/v2/connected-sources", {
        headers: { "x-telegram-init-data": getTgInitData() },
      });
      const json = await safeJson(res);
      if (!res.ok) return;
      const next = { lastfm: null, letterboxd: null } as typeof connectedProfiles;
      for (const source of Array.isArray(json?.sources) ? json.sources : []) {
        if (source?.platform === "lastfm") {
          next.lastfm = { profile: source.profile, lastSyncedAt: source.lastSyncedAt ?? null };
        }
        if (source?.platform === "letterboxd") {
          next.letterboxd = { profile: source.profile, lastSyncedAt: source.lastSyncedAt ?? null };
        }
      }
      setConnectedProfiles(next);
      if (next.lastfm?.profile) setLastfmProfileInput(next.lastfm.profile);
      if (next.letterboxd?.profile) setLetterboxdProfileInput(next.letterboxd.profile);
    } catch {}
  }

  return {
    spotifyConnected, spotifyProfileName, connectedProfiles, spotifySyncing,
    fileRef, csvImportRef, importLoading, importError, importStatus, imported,
    selectedIdx, savingImported, selectedImportService,
    lastfmProfileInput, letterboxdProfileInput, yandexMusicUrl,
    setImportError, setImportStatus, setImported, setSelectedIdx, setImportLoading,
    setSelectedImportService, setLastfmProfileInput, setLetterboxdProfileInput, setYandexMusicUrl,
    importCsvPlatform, importYandexMusicPlaylist, toggleImported, runImport, saveSelected,
    saveSelectedImported, startImportService, importLastfmProfileWeb,
    importLetterboxdProfileWeb, confirmCsvImport,
    checkSpotify, disconnectSpotify, connectSpotify, syncSpotify,
    disconnectConnectedProfile, loadConnectedProfiles,
  };
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("profile");
  const [aboutStep, setAboutStep] = useState(0);
  const [libraryView, setLibraryView] = useState<"tiles" | "calendar">("calendar");
  const [helloName, setHelloName] = useState("привет!");
  const [tgUserId, setTgUserId] = useState<number | null>(null);
  const [adminViewOff, setAdminViewOff] = useState(false);
  const isAdmin = isAdminTgId(tgUserId) && !adminViewOff;

  useEffect(() => {
    try {
      setAdminViewOff(localStorage.getItem("everyyou:admin-view-off") === "1");
    } catch {}
  }, []);

  function toggleAdminView() {
    const next = !adminViewOff;
    setAdminViewOff(next);
    if (next && tab === "admin") setTab("home");
    try {
      localStorage.setItem("everyyou:admin-view-off", next ? "1" : "0");
    } catch {}
  }

  // Telegram Analytics SDK
  useEffect(() => {
    if (document.getElementById("tg-analytics-sdk")) return;
    const script = document.createElement("script");
    script.id = "tg-analytics-sdk";
    script.async = true;
    script.src = "https://tonsdk.io/sdk.js";
    script.setAttribute("data-telegram-analytics-token", process.env.NEXT_PUBLIC_TG_ANALYTICS_TOKEN || "");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    try { tg?.ready?.(); tg?.expand?.(); } catch {}
    const first = tg?.initDataUnsafe?.user?.first_name;
    const last = tg?.initDataUnsafe?.user?.last_name;
    const username = tg?.initDataUnsafe?.user?.username;
    const name = first || last
      ? [first, last].filter(Boolean).join(" ")
      : username ? `@${username}` : "";
    setHelloName(name ? `привет, ${name}` : "привет");
    const uid = tg?.initDataUnsafe?.user?.id;
    if (uid) setTgUserId(Number(uid));
  }, []);

  useEffect(() => {
    if (autoLinkHandledRef.current) return;
    const tg = (window as any).Telegram?.WebApp;
    const startParam = tg?.initDataUnsafe?.start_param;
    const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
    const fallbackParam = url?.searchParams.get("tgWebAppStartParam") ?? url?.searchParams.get("startapp") ?? "";
    const raw = `${startParam ?? fallbackParam}`.trim();
    const match = raw.match(/^link[_: -]?([A-Z0-9]+)$/i);
    if (!match?.[1]) return;

    autoLinkHandledRef.current = true;
    const code = match[1].toUpperCase();
    profile.setTelegramLinkCode(code);
    profile.setShowTelegramManualLink(true);
    profile.setTelegramLinkStatus("код из qr уже подставили");
    void profile.linkMobileAccount(code);
  }, []);

  useEffect(() => {
    if (!tgUserId) return;
    fireAnalytics("app_open", {
      librarySize: items.length,
      hasCustomName: Boolean(helloName.replace(/^привет,?\s*/i, "").trim()),
      themeMode: "light",
    });
  }, [tgUserId]);

  useEffect(() => {
    if (!tgUserId) return;
    fireAnalytics("screen_view", { screen: tab });
  }, [tab, tgUserId]);

  // ===== Library =====
  const [items, setItems] = useState<DbItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [showShareCard, setShowShareCard] = useState(false);
  const [shareCardDataUrl, setShareCardDataUrl] = useState<string | null>(null);
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [sharePickerSelected, setSharePickerSelected] = useState<Set<string | number>>(new Set());
  const [sharePickerText, setSharePickerText] = useState<string | undefined>(undefined);
  const [sharePickerType, setSharePickerType] = useState<"vibe" | "deep" | undefined>(undefined);
  const autoLinkHandledRef = useRef(false);

  async function loadLibrary() {
    setLibraryLoading(true);
    setLibraryError("");
    try {
      const res = await fetch("/api/items", {
        headers: { "x-telegram-init-data": getTgInitData() },
      });
      const json = await safeJson(res);
      if (!res.ok) { setLibraryError(json?.error ?? "Ошибка загрузки"); setItems([]); return; }
      setItems(Array.isArray(json?.items) ? json.items : []);
    } catch (e: any) {
      setLibraryError(e?.message ?? "Network error");
    } finally {
      setLibraryLoading(false);
    }
  }

  const vibe = useVibecheck();
  const imports = useImports({ items, loadLibrary, setTab });
  const library = useLibrary({ items, loadLibrary, setLibraryError, setLibraryLoading });
  const profile = useProfile({ loadLibrary, setLibraryError });

  useEffect(() => { loadLibrary(); loadCustomCategories(); vibe.fetchDeepVibeAccess(); imports.loadConnectedProfiles(); profile.loadProfileSettings(); }, []);

  const countsUnknown = libraryLoading && items.length === 0;
  const counts = useMemo(() => ({
    total: items.length,
    music: items.filter((i) => i.type === "music").length,
    books: items.filter((i) => i.type === "book").length,
    movies: items.filter((i) => i.type === "movie").length,
  }), [items]);

  const headerAvatar = useMemo(() => {
    const raw = helloName.replace(/^привет,?\s*/i, "").trim();
    if (!raw || raw === "привет!") return "◐";
    const first = raw[0];
    return first ? first.toUpperCase() : "◐";
  }, [helloName]);

  // ===== Import =====

  const importServices: ImportService[] = [
    { id: "spotify", title: "Spotify", subtitle: "музыка", icon: "◉", kind: "oauth", actionLabel: "подключить spotify" },
    {
      id: "livelib",
      title: "LiveLib",
      subtitle: "книги csv",
      icon: "▤",
      kind: "csv",
      actionLabel: "выбрать файл",
      instructions: [
        "нужен csv",
        "у livelib нет одного понятного официального экспорта для нас, поэтому сейчас нужен уже готовый csv",
        "подойдет выгрузка через livelib-backup или любой csv, где есть название и автор",
        "потом просто выбери этот файл из «файлов»",
      ],
    },
    {
      id: "goodreads",
      title: "Goodreads",
      subtitle: "книги csv",
      icon: "G",
      kind: "csv",
      actionLabel: "выбрать файл",
      instructions: [
        "нужен csv",
        "в goodreads открой my books → import and export",
        "нажми export library и потом загрузи сюда получившийся csv-файл",
      ],
    },
    {
      id: "letterboxd",
      title: "Letterboxd",
      subtitle: "public profile beta",
      icon: "◌",
      kind: "profile",
      actionLabel: "импортировать профиль",
      instructions: [
        "можно без csv",
        "вставь username или ссылку на публичный profile letterboxd",
        "мы попробуем забрать recent diary / watched через public rss",
        "если профиль закрыт или rss не поможет — всегда можно вернуться к watched.csv",
      ],
    },
    {
      id: "lastfm",
      title: "last.fm",
      subtitle: "recent tracks beta",
      icon: "♪",
      kind: "profile",
      actionLabel: "импортировать профиль",
      instructions: [
        "recent tracks beta",
        "введи username last.fm и мы попробуем забрать recent tracks через api",
        "если у треков есть scrobble time, они сразу лягут в календарь по дням",
        "если этот способ не сработает, всегда можно загрузить csv",
      ],
    },
    {
      id: "kinopoisk",
      title: "Кинопоиск",
      subtitle: "просмотры csv",
      icon: "★",
      kind: "csv",
      actionLabel: "выбрать файл",
      instructions: [
        "нужен csv",
        "если у тебя уже есть csv с просмотрами или оценками из кинопоиска, можно загрузить его сюда",
        "если в файле есть watched / isWatched / watched date, возьмем только просмотренное",
        "дальше просто выбери файл из «файлов»",
      ],
    },
    {
      id: "mubi",
      title: "MUBI",
      subtitle: "фильмы csv",
      icon: "●",
      kind: "csv",
      actionLabel: "выбрать файл",
      instructions: [
        "нужен csv",
        "если у тебя уже есть csv с просмотренными фильмами из mubi, можно загрузить его сюда",
        "лучше всего подходят колонки title или name, а еще year, director и дата просмотра, если она есть",
        "дальше просто выбери файл из «файлов»",
      ],
    },
  ];

  // ===== Custom Categories =====
  type CustomCategory = { id: string; name: string; emoji: string; };
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("📌");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  async function loadCustomCategories() {
    try {
      const res = await fetch("/api/custom-categories", {
        headers: { "x-telegram-init-data": getTgInitData() },
      });
      const json = await safeJson(res);
      if (res.ok) setCustomCategories(json?.categories ?? []);
    } catch {}
  }

  async function createCustomCategory() {
    if (!newCatName.trim()) return;
    setCatSaving(true); setCatError("");
    try {
      const res = await fetch("/api/custom-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-telegram-init-data": getTgInitData() },
        body: JSON.stringify({ name: newCatName.trim(), emoji: newCatEmoji }),
      });
      const json = await safeJson(res);
      if (!res.ok) { setCatError(json?.error ?? "ошибка"); return; }
      await loadCustomCategories();
      setSelectedCatId(json?.category?.id ?? null);
      setNewCatName(""); setNewCatEmoji("📌");
      setShowCreateCategory(false);
    } catch (e: any) { setCatError(e?.message); }
    finally { setCatSaving(false); }
  }

  // ===== Manual Add =====
  const [manualMode, setManualMode] = useState(false);
  const [manualType, setManualType] = useState<ItemType>("book");
  const titlePlaceholder = useAnimatedPlaceholder(manualType, "title");
  const creatorPlaceholder = useAnimatedPlaceholder(manualType, "creator");
  const [manualTitle, setManualTitle] = useState("");
  const [manualCreator, setManualCreator] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState(false);

  async function saveManual() {
    if (!manualTitle.trim()) { setManualError("Введи название"); return; }
    if (manualType === "custom" && !selectedCatId) { setManualError("Выбери категорию"); return; }
    setManualSaving(true); setManualError(""); setManualSuccess(false);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": getTgInitData(),
        },
        body: JSON.stringify({
          type: manualType,
          source: "manual",
          title: manualTitle.trim(),
          creator: manualCreator.trim() || null,
          ...(manualType === "custom" && selectedCatId ? { custom_category_id: selectedCatId } : {}),
        }),
      });
      const json = await safeJson(res);
      if (!res.ok) { setManualError(json?.error ?? "Ошибка"); return; }
      setManualTitle(""); setManualCreator(""); setManualSuccess(true);
      await loadLibrary();
      setTimeout(() => setManualSuccess(false), 2000);
    } catch (e: any) {
      setManualError(e?.message ?? "Ошибка");
    } finally {
      setManualSaving(false);
    }
  }

  // ===== Delete =====
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  async function deleteItem(id: string | number) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/items", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": getTgInitData(),
        },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setItems((prev) => prev.filter((it) => it.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  // ===== Vibe =====

  // Генерируем карточку по текущему состоянию приложения

  function openSharePicker(text?: string, type?: "vibe" | "deep") {
    setSharePickerText(text);
    setSharePickerType(type);
    vibe.setShareRunId(type === "vibe" ? vibe.vibeRunId : null);
    // По умолчанию выбираем все айтемы
    setSharePickerSelected(new Set(items.map(i => i.id)));
    setShowSharePicker(true);
  }

  async function shareVibeCard(text: string, type: "vibe" | "deep") {
    openSharePicker(text, type);
  }

  // Подписка на скриншот (Telegram WebApp API)
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;
    const handler = async () => {
      const dataUrl = await generateShareCard(items);
      setShareCardDataUrl(dataUrl);
      setShowShareCard(true);
    };
    // Telegram WebApp использует tg.onEvent напрямую
    if (typeof tg.onEvent === "function") {
      tg.onEvent("screenshot_taken", handler);
      return () => tg.offEvent("screenshot_taken", handler);
    }
  }, [items]);

  // Проверяем доступ при переходе на вкладку вайбчека
  const prevTabRef = useRef<string>("");
  useEffect(() => {
    if (tab === "vibe" && prevTabRef.current !== "vibe") {
      vibe.fetchDeepVibeAccess();
    }
    if (tab === "add" && prevTabRef.current !== "add") {
      imports.checkSpotify();
      imports.loadConnectedProfiles();
      if (vibe.deepVibeAccess === null) vibe.fetchDeepVibeAccess();
    }
    prevTabRef.current = tab;
  }, [tab]);

  // ===== Library filter =====

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <div className="app">
        <div className="header">
          <div className="header-row">
            <div className="header-avatar">{profile.profileAvatarUrl ? <img src={profile.profileAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }} /> : headerAvatar}</div>
            <div className="header-copy">
              <button className="brand-link" onClick={() => { setAboutStep(0); setTab("home"); }}>
                everyyou
              </button>
            </div>
          </div>
          <div className="sync-line">культурный таймлайн, который собирается сам.</div>
        </div>

        {/* ABOUT / ONBOARDING */}
        {tab === "home" && (
          <div className="card" style={{ background: aboutStep === 0 ? "#38C0FF" : aboutStep === 1 ? "#FF79D5" : "#49DE4E" }}>
            <div className="card-title">
              {aboutStep === 0 ? "твой культурный таймлайн" : aboutStep === 1 ? "добавляй как удобно" : "потом станет интереснее"}
            </div>
            <p className="card-text">
              {aboutStep === 0
                ? "сюда можно скидывать музыку, книги и фильмы, которые реально были с тобой. не список на потом, а след того, что происходило."
                : aboutStep === 1
                  ? "можно подключить сервис, загрузить скриншот, фотку книжной полки или просто вписать все вручную."
                  : "из этого собираются библиотека, календарь и вайбчек, который начинает замечать темы, периоды и сдвиги в настроении."}
            </p>

            {aboutStep === 0 ? (
              <div className="home-tiles" style={{ marginTop: 18 }}>
                <div className="home-tile" style={{ minHeight: 138, background: "#ffffff" }}>
                  <div className="home-tile-label">не вишлист</div>
                  <div className="home-tile-title">то, что было с тобой</div>
                </div>
                <div className="home-tile" style={{ minHeight: 138, background: "#FFC804" }}>
                  <div className="home-tile-label">в одном месте</div>
                  <div className="home-tile-title">музыка, книги, фильмы</div>
                </div>
              </div>
            ) : aboutStep === 1 ? (
              <div className="home-tiles" style={{ marginTop: 18 }}>
                <div className="home-tile tile-pink" style={{ minHeight: 138 }}><div className="home-tile-label">музыка</div><div className="home-tile-title">сервисы и плейлисты</div></div>
                <div className="home-tile tile-green" style={{ minHeight: 138 }}><div className="home-tile-label">все остальное</div><div className="home-tile-title">фото, csv и вручную</div></div>
              </div>
            ) : (
              <div className="home-tiles" style={{ marginTop: 18 }}>
                <div className="home-tile tile-blue" style={{ minHeight: 138 }}><div className="home-tile-label">библиотека</div><div className="home-tile-title">собирается сама</div></div>
                <div className="home-tile tile-yellow" style={{ minHeight: 138 }}><div className="home-tile-label">вайбчек</div><div className="home-tile-title">замечает сдвиги</div></div>
              </div>
            )}

            <div className="about-progress">
              {[0, 1, 2].map((step) => <div key={step} className={`about-progress-dot${step <= aboutStep ? " active" : ""}`} />)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {aboutStep > 0 ? <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAboutStep((step) => step - 1)}>назад</button> : null}
              <button className="btn" style={{ flex: 1 }} onClick={() => aboutStep === 2 ? setTab("profile") : setAboutStep((step) => step + 1)}>
                {aboutStep === 2 ? "к профилю" : "дальше"}
              </button>
            </div>
          </div>
        )}

        {tab === "profile" && (
          <>
            <div className="card" style={{ background: "#ffe8f7" }}>
              <div className="card-title">профиль</div>
              <p className="card-text">здесь живут тихие настройки твоей библиотеки.</p>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
                <div className="header-avatar">{profile.profileAvatarUrl ? <img src={profile.profileAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }} /> : headerAvatar}</div>
                <div style={{ flex: 1 }}>
                  <input ref={profile.profileAvatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) void profile.uploadProfileAvatar(file); event.target.value = ""; }} />
                  <button className="btn btn-secondary btn-sm" onClick={() => profile.profileAvatarInputRef.current?.click()} disabled={profile.profileSaving}>загрузить аватар</button>
                  {profile.profileAvatarUrl ? <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => void profile.saveProfileSettings({ avatarUrl: null })} disabled={profile.profileSaving}>убрать</button> : null}
                </div>
              </div>
              {profile.editingProfileName || !profile.profileName ? (
                <>
                  <div className="input-group" style={{ marginTop: 16 }}>
                    <div className="input-label">как тебя зовут</div>
                    <input className="input" value={profile.profileNameDraft} placeholder="например, настя" onChange={(event) => profile.setProfileNameDraft(event.target.value)} />
                  </div>
                  <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={async () => { if (await profile.saveProfileSettings({ displayName: profile.profileNameDraft })) profile.setEditingProfileName(false); }} disabled={profile.profileSaving}>
                    {profile.profileSaving ? "сохраняем..." : "сохранить"}
                  </button>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
                  <div>
                    <div className="input-label">имя</div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 3 }}>{profile.profileName}</div>
                  </div>
                  <button className="btn btn-outline btn-sm" style={{ width: "auto" }} onClick={() => profile.setEditingProfileName(true)}>изменить</button>
                </div>
              )}
              <div className="stats" style={{ marginTop: 16 }}>
                <div className="stat-pill"><div className="stat-num">{countsUnknown ? "—" : counts.total}</div><div className="stat-label">всего</div></div>
                <div className="stat-pill"><div className="stat-num">{countsUnknown ? "—" : counts.music}</div><div className="stat-label">музыка</div></div>
                <div className="stat-pill"><div className="stat-num">{countsUnknown ? "—" : counts.books}</div><div className="stat-label">книги</div></div>
                <div className="stat-pill"><div className="stat-num">{countsUnknown ? "—" : counts.movies}</div><div className="stat-label">фильмы</div></div>
              </div>
            </div>

            {isAdminTgId(tgUserId) && (
              <div className="card">
                <div className="card-title">режим</div>
                <p className="card-text">
                  {adminViewOff
                    ? "сейчас приложение выглядит так, как его видит обычный человек."
                    : "видна вкладка со статистикой и разметкой."}
                </p>
                <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={toggleAdminView}>
                  {adminViewOff ? "вернуть админку" : "смотреть как обычный человек"}
                </button>
              </div>
            )}

            <div className="card">
              <div className="card-title">подключенные сервисы</div>
              <p className="card-text">здесь можно обновить импорт или отвязать источник. новые ссылки, файлы и скриншоты добавляются во вкладке «добавить».</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                <div style={{ padding: "14px", border: "1px solid #e7e2d9", borderRadius: 18 }}>
                  <div style={{ fontWeight: 800 }}>Spotify</div>
                  <div className="card-text" style={{ marginTop: 4 }}>
                    {imports.spotifyConnected ? `подключен${imports.spotifyProfileName ? `: ${imports.spotifyProfileName}` : ""}` : "не подключен"}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {imports.spotifyConnected ? (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => void imports.syncSpotify()} disabled={imports.spotifySyncing}>
                          {imports.spotifySyncing ? "обновляем..." : "обновить импорт"}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => void imports.disconnectSpotify(false)} disabled={imports.spotifySyncing}>
                          отвязать
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => void imports.connectSpotify()}>
                        подключить
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ padding: "14px", border: "1px solid #e7e2d9", borderRadius: 18 }}>
                  <div style={{ fontWeight: 800 }}>last.fm</div>
                  <div className="card-text" style={{ marginTop: 4 }}>
                    {imports.connectedProfiles.lastfm ? `подключен: ${imports.connectedProfiles.lastfm.profile}` : "не подключен"}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => imports.setSelectedImportService(importServices.find((service) => service.id === "lastfm") ?? null)} disabled={imports.importLoading}>
                      {imports.connectedProfiles.lastfm ? "обновить импорт" : "подключить"}
                    </button>
                    {imports.connectedProfiles.lastfm ? (
                      <button className="btn btn-outline btn-sm" onClick={() => void imports.disconnectConnectedProfile("lastfm", false)} disabled={imports.importLoading}>
                        отвязать
                      </button>
                    ) : null}
                  </div>
                </div>

                <div style={{ padding: "14px", border: "1px solid #e7e2d9", borderRadius: 18 }}>
                  <div style={{ fontWeight: 800 }}>Letterboxd</div>
                  <div className="card-text" style={{ marginTop: 4 }}>
                    {imports.connectedProfiles.letterboxd ? `подключен: ${imports.connectedProfiles.letterboxd.profile}` : "не подключен"}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => imports.setSelectedImportService(importServices.find((service) => service.id === "letterboxd") ?? null)} disabled={imports.importLoading}>
                      {imports.connectedProfiles.letterboxd ? "обновить импорт" : "подключить"}
                    </button>
                    {imports.connectedProfiles.letterboxd ? (
                      <button className="btn btn-outline btn-sm" onClick={() => void imports.disconnectConnectedProfile("letterboxd", false)} disabled={imports.importLoading}>
                        отвязать
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <button className="btn btn-outline" style={{ marginTop: 14 }} onClick={() => setTab("add")}>
                добавить из другого сервиса
              </button>
              {imports.importStatus ? <div style={{ marginTop: 10, fontSize: 13, color: "#666" }}>{imports.importStatus}</div> : null}
              {imports.importError ? <div className="error" style={{ marginTop: 10 }}>{imports.importError}</div> : null}
            </div>

          </>
        )}

        {/* ADD */}
        {tab === "add" && (
          <div className="card">
            <div className="card-title">добавить</div>

            <div
              className="mode-toggle"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <button
                className={`mode-btn${!manualMode ? " active" : ""}`}
                onClick={() => setManualMode(false)}
                style={{ width: "100%" }}
              >
                импорт изображения
              </button>
              <button
                className={`mode-btn${manualMode ? " active" : ""}`}
                onClick={() => setManualMode(true)}
                style={{ width: "100%" }}
              >
                вручную
              </button>
            </div>

            {/* MANUAL MODE */}
            {manualMode && (
              <>
                <div className="section-label">тип контента</div>
                <div className="type-row">
                  {(["music", "book", "movie"] as ItemType[]).map((t) => (
                    <button
                      key={t}
                      className={`type-btn${manualType === t ? " active" : ""}`}
                      onClick={() => setManualType(t)}
                    >
                      {TYPE_ICONS[t]} {TYPE_LABELS[t]}
                    </button>
                  ))}
                  {/* Кнопка своей категории — только для платных */}
                  <button
                    className={`type-btn${manualType === "custom" ? " active" : ""}`}
                    style={!(vibe.deepVibeAccess === "forever" || vibe.deepVibeAccess === "paid") ? {opacity:0.45} : {}}
                    onClick={() => {
                      if (vibe.deepVibeAccess === "forever" || vibe.deepVibeAccess === "paid") {
                        setManualType("custom");
                      } else {
                        vibe.buyDeepVibeForever();
                      }
                    }}
                    title={vibe.deepVibeAccess === "forever" || vibe.deepVibeAccess === "paid" ? "своя категория" : "доступно с подпиской"}
                  >
                    ✦ своё {!(vibe.deepVibeAccess === "forever" || vibe.deepVibeAccess === "paid") && "🔒"}
                  </button>
                </div>

                {/* UI кастомной категории */}
                {manualType === "custom" && (
                  <div style={{marginBottom:16}}>
                    <div className="section-label">категория</div>
                    {customCategories.length > 0 && (
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                        {customCategories.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedCatId(cat.id)}
                            style={{
                              padding:"7px 14px",
                              border:`1px solid ${selectedCatId === cat.id ? "#000" : "#e0e0e0"}`,
                              background: selectedCatId === cat.id ? "#000" : "#fff",
                              color: selectedCatId === cat.id ? "#fff" : "#000",
                              fontSize:13,
                              cursor:"pointer",
                              display:"flex",alignItems:"center",gap:6,
                            }}
                          >
                            {cat.emoji} {cat.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {!showCreateCategory ? (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setShowCreateCategory(true)}
                        style={{width:"auto",fontSize:12}}
                      >
                        + новая категория
                      </button>
                    ) : (
                      <div style={{border:"1px solid #e8e8e8",padding:16,marginTop:8}}>
                        <div className="input-group" style={{marginBottom:10}}>
                          <div className="input-label">эмодзи</div>
                          <input
                            className="input"
                            placeholder="📌"
                            value={newCatEmoji}
                            onChange={e => setNewCatEmoji(e.target.value)}
                            style={{width:72}}
                            maxLength={2}
                          />
                        </div>
                        <div className="input-group" style={{marginBottom:10}}>
                          <div className="input-label">название категории</div>
                          <input
                            className="input"
                            placeholder="подкасты, чипсы, игры..."
                            value={newCatName}
                            onChange={e => setNewCatName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && createCustomCategory()}
                          />
                        </div>
                        {catError && <div className="error">{catError}</div>}
                        <div style={{display:"flex",gap:8,marginTop:10}}>
                          <button className="btn btn-sm" onClick={createCustomCategory} disabled={catSaving}>
                            {catSaving ? "..." : "создать"}
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => { setShowCreateCategory(false); setCatError(""); }}>
                            отмена
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="input-group">
                  <div className="input-label">название</div>
                  <input
                    className="input"
                    placeholder={titlePlaceholder}
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveManual()}
                  />
                </div>

                <div className="input-group">
                  <div className="input-label">
                    {manualType === "music" ? "исполнитель" : manualType === "book" ? "автор" : manualType === "custom" ? "автор / бренд" : "режиссёр"}
                    {" "}
                    <span style={{ color: "#bbb", fontWeight: 300 }}>(необязательно)</span>
                  </div>
                  <input
                    className="input"
                    placeholder={creatorPlaceholder}
                    value={manualCreator}
                    onChange={(e) => setManualCreator(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveManual()}
                  />
                </div>

                {manualError && <div className="error">{manualError}</div>}
                {manualSuccess && <div className="success">✓ сохранено!</div>}

                <div style={{ marginTop: 16 }}>
                  <button className="btn" onClick={saveManual} disabled={manualSaving}>
                    {manualSaving ? "сохраняю..." : "сохранить →"}
                  </button>
                </div>
              </>
            )}

            {/* IMPORT MODE */}
            {!manualMode && (
              <>
                <p className="card-text" style={{ marginBottom: 6 }}>
                  Загрузи до 10 изображений: скриншоты откуда угодно, фото книжной полки, обложек в магазине, постеров или экранов сервисов. ИИ постарается разобрать, что там, и собрать это в таймлайн.
                </p>
                <div className="import-service-grid">
                  {importServices.map((service) => (
                    <div key={service.id} className="import-service">
                      <button
                        type="button"
                        className="import-service-help"
                        onClick={() => imports.setSelectedImportService(service)}
                        disabled={imports.importLoading || imports.savingImported || imports.spotifySyncing}
                        aria-label={`инструкция ${service.title}`}
                      >
                        ?
                      </button>
                      <button
                        type="button"
                        className="import-service-main"
                        onClick={() => imports.startImportService(service)}
                        disabled={imports.importLoading || imports.savingImported || imports.spotifySyncing}
                      >
                        <div className="import-service-head">
                          <div className="import-service-icon">{service.icon}</div>
                          <div className="import-service-title">{service.title}</div>
                        </div>
                        <div className="import-service-subtitle">{service.subtitle}</div>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="input-group" style={{ marginTop: 16 }}>
                  <div className="input-label">плейлист Яндекс.Музыки</div>
                  <input
                    className="input"
                    placeholder="вставь публичную ссылку на плейлист"
                    value={imports.yandexMusicUrl}
                    onChange={(e) => imports.setYandexMusicUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && imports.importYandexMusicPlaylist()}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <div className="card-text" style={{ marginTop: 6 }}>плейлист должен быть открыт по ссылке</div>
                  <button className="btn btn-outline" style={{ marginTop: 10 }} onClick={imports.importYandexMusicPlaylist} disabled={imports.importLoading}>
                    {imports.importLoading ? "читаем плейлист..." : "импортировать плейлист"}
                  </button>
                </div>

                <input
                  ref={imports.csvImportRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && imports.selectedImportService && imports.selectedImportService.id !== "spotify") {
                      imports.importCsvPlatform(imports.selectedImportService.id, f);
                    }
                    e.target.value = "";
                  }}
                />

                <input
                  ref={imports.fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) imports.runImport(files);
                  }}/>

                <button
                  className="btn btn-outline"
                  onClick={() => imports.fileRef.current?.click()}
                  disabled={imports.importLoading}
                >
                  {imports.importLoading ? "разбираю изображения..." : "загрузить изображения →"}
                </button>

                {imports.importStatus && !imports.importError && (
                  <div style={{marginTop:12,fontSize:13,color:"#6f6a63"}}>{imports.importStatus}</div>
                )}
                {imports.importError && <div className="error">{imports.importError}</div>}

                {imports.imported.length > 0 && (
                  <>
                    <hr className="divider" />
                    <div className="section-label">найдено {imports.imported.length} айтемов</div>
                    <div
                      style={{
                        position: "sticky",
                        top: 12,
                        zIndex: 5,
                        background: "#faf8f3",
                        paddingBottom: 10,
                        marginBottom: 6,
                      }}
                    >
                      <button
                        className="btn"
                        style={{ marginBottom: 0 }}
                        onClick={imports.saveSelectedImported}
                        disabled={imports.savingImported}
                      >
                        {imports.savingImported ? "сохраняю..." : `сохранить выбранное (${imports.selectedIdx.size}) →`}
                      </button>
                    </div>

                  {imports.imported.map((it, i) => (
                      <div
                        key={i}
                        className={`import-item${imports.selectedIdx.has(i) ? " selected" : ""}`}
                        onClick={() => imports.toggleImported(i)}
                      >
                        <input
                          type="checkbox"
                          checked={imports.selectedIdx.has(i)}
                          onChange={() => imports.toggleImported(i)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ marginTop: 3, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{it.title}</div>
                          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{it.creator || "—"}</div>
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <span className="tag">{it.type === "custom" && it.custom_category_name ? `${it.custom_category_emoji ?? "✦"} ${it.custom_category_name}` : TYPE_LABELS[it.type]}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      className="btn"
                      style={{ marginTop: 8 }}
                      onClick={imports.saveSelectedImported}
                      disabled={imports.savingImported}
                    >
                      {imports.savingImported ? "сохраняю..." : `сохранить выбранное (${imports.selectedIdx.size}) →`}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* LIBRARY */}
        {tab === "library" && (
          <>
            <div className="library-shell">
              <div className="library-top-row">
                <div className="card-title" style={{ marginBottom: 0 }}>библиотека</div>
                <div className="compact-toggle">
                  <button
                    type="button"
                    className={`filter-btn${libraryView === "tiles" ? " active" : ""}`}
                    onClick={() => setLibraryView("tiles")}
                  >
                    плитки
                  </button>
                  <button
                    type="button"
                    className={`filter-btn${libraryView === "calendar" ? " active" : ""}`}
                    onClick={() => setLibraryView("calendar")}
                  >
                    календарь
                  </button>
                </div>
              </div>
            <div className="library-copy">
              смотри все вместе или раскладывай по типам. в календаре видно, что с тобой происходило по дням.
            </div>

            {library.libraryStatus && !libraryError && <div className="status-note">{library.libraryStatus}</div>}
            {library.returnDay && !library.calendarMoveMode ? (
              <div className="calendar-move-banner" style={{ marginBottom: 16 }}>
                <div className="calendar-move-copy">
                  <div className="section-label" style={{ marginBottom: 4 }}>
                    {library.lastMovedTargetDay
                      ? `перенесли на ${library.lastMovedTargetDay.date.toLocaleString("ru-RU", { day: "numeric", month: "long" })}`
                      : "дату перенесли"}
                  </div>
                  <div>если хочешь, можно сразу вернуться к прежнему дню.</div>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={library.jumpBackToReturnDay}>
                  {`вернуться к ${library.returnDay.date.toLocaleString("ru-RU", { day: "numeric", month: "long" })}`}
                </button>
              </div>
            ) : null}

            <div className="section-label">тип контента</div>
              <div className="filter-row">
                {([["all", "все"], ["music", "музыка"], ["book", "книги"], ["movie", "фильмы"]] as [string, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`filter-btn${library.libFilter === val ? " active" : ""}`}
                    onClick={() => library.setLibFilter(val)}
                  >
                    {label}
                  </button>
                ))}
                {customCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`filter-btn${library.libFilter === cat.id ? " active" : ""}`}
                    onClick={() => library.setLibFilter(cat.id)}
                  >
                    {cat.emoji} {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {libraryError && <div className="error">{libraryError}</div>}

            {libraryLoading ? (
              <div className="empty">загружаю…</div>
            ) : library.filteredItems.length === 0 ? (
              <div className="empty">
                {items.length === 0 ? "пока пусто — добавь что-нибудь!" : "нет айтемов этого типа"}
              </div>
            ) : libraryView === "calendar" ? (
              <>
                <div className="calendar-shell">
                  {library.calendarMoveMode && library.selectedDayItems.length > 0 ? (
                    <div className="calendar-move-banner">
                      <div className="calendar-move-copy">
                        <div className="section-label" style={{ marginBottom: 4 }}>перенос даты</div>
                        <div>выбери новый день для {library.selectedDayItems.length} {library.selectedDayItems.length === 1 ? "айтема" : library.selectedDayItems.length < 5 ? "айтемов" : "айтемов"}.</div>
                      </div>
                      <button type="button" className="btn btn-outline btn-sm" onClick={library.cancelMoveSelectedDayItems}>отмена</button>
                    </div>
                  ) : null}
                  <div className="calendar-top-row">
                    <button className="calendar-arrow" onClick={() => library.setCalendarMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1)))}>‹</button>
                    <div className="calendar-title">
                      {library.calendarMonth
                        .toLocaleString("ru-RU", { month: "long", year: "numeric" })
                        .replace(/\sг\.$/, "")
                        .replace(/^./, (char) => char.toUpperCase())}
                    </div>
                    <div className="calendar-top-actions">
                      <button
                        type="button"
                        className="calendar-arrow calendar-today"
                        onClick={() => {
                          const today = new Date();
                          library.setCalendarMonth(startOfMonth(today));
                          library.setSelectedDayKey(dayKey(today));
                        }}
                      >
                        сегодня
                      </button>
                      <button className="calendar-arrow" onClick={() => library.setCalendarMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1)))}>›</button>
                    </div>
                  </div>

                  {library.monthlySummary && (
                    <div className="vibe-section vibe-pink" style={{ marginTop: 4, marginBottom: 12 }}>
                      <div className="section-label" style={{ marginBottom: 4 }}>по месяцу</div>
                      <div>{library.monthlySummary}</div>
                    </div>
                  )}

                  <div className="calendar-weekdays">
                    {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((label) => (
                      <div key={label} className="calendar-weekday">{label}</div>
                    ))}
                  </div>

                  <div className="calendar-grid">
                    {library.calendarDays.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        className={`calendar-day${!day.inMonth ? " muted" : ""}${library.selectedDay?.key === day.key ? " selected" : ""}`}
                        onClick={() => {
                          if (library.calendarMoveMode) {
                            library.setPendingMoveTargetKey(day.key);
                            return;
                          }
                          library.setSelectedDayKey(day.key);
                          library.setSelectedDayTypeFilter("all");
                          library.setSelectedDayItems([]);
                          library.setDayModalOpen(true);
                        }}
                      >
                        <div className="calendar-day-head">
                          <span className="calendar-day-number">{day.date.getDate()}</span>
                          {day.items.length > 0 ? <span className="calendar-day-count">{day.items.length}</span> : null}
                        </div>
                        <div className="calendar-dots">
                          {day.items.slice(0, 4).map((item) => (
                            <div key={String(item.id)} className={`calendar-dot ${item.type}`} />
                          ))}
                        </div>
                        {day.items.length > 4 ? <div className="calendar-more">+ еще {day.items.length - 4}</div> : null}
                      </button>
                    ))}
                  </div>
                </div>

                {library.dayModalOpen && library.selectedDay ? (
                  <div className="day-modal-backdrop" onClick={() => library.setDayModalOpen(false)}>
                    <div className="day-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="day-modal-head">
                        <div className="card-title" style={{ marginBottom: 0 }}>
                          {library.selectedDay.date
                            .toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
                            .replace(/^./, (char) => char.toUpperCase())}
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={() => library.setDayModalOpen(false)}>закрыть</button>
                      </div>

                      <div className="day-week-strip">
                        {Array.from({ length: 7 }, (_, index) => {
                          const selectedDay = library.selectedDay!;
                          const base = addDays(selectedDay.date, -((selectedDay.date.getDay() + 6) % 7));
                          const date = addDays(base, index);
                          const key = dayKey(date);
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`day-week-pill${key === selectedDay.key ? " active" : ""}`}
                              onClick={() => {
                                library.setSelectedDayKey(key);
                                library.setSelectedDayTypeFilter("all");
                                library.setSelectedDayItems([]);
                              }}
                            >
                              <div className="day-week-name">{date.toLocaleString("ru-RU", { weekday: "short" })}</div>
                              <div className="day-week-number">{date.getDate()}</div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="day-type-filters">
                        {([["all", `все ${library.selectedDayCounts.all}`], ["music", `музыка ${library.selectedDayCounts.music}`], ["book", `книги ${library.selectedDayCounts.book}`], ["movie", `фильмы ${library.selectedDayCounts.movie}`]] as [ItemType | "all", string][]).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={`filter-btn compact${library.selectedDayTypeFilter === value ? " active" : ""}`}
                            onClick={() => library.setSelectedDayTypeFilter(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {library.selectedDayItems.length > 0 ? (
                        <div className="day-action-row">
                          <button type="button" className="btn btn-outline btn-sm" onClick={library.startMoveSelectedDayItems}>
                            {library.selectedDayItems.length === 1 ? "изменить дату" : `изменить дату (${library.selectedDayItems.length})`}
                          </button>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => library.setSelectedDayItems([])}>
                            снять выбор
                          </button>
                        </div>
                      ) : null}

                      <div className="day-modal-scroll">
                        {library.selectedDayVisibleItems.length > 0 ? (
                          <div className="day-items-grid">
                            {library.selectedDayVisibleItems.map((it) => (
                              <button
                                key={String(it.id)}
                                type="button"
                                className={`item-card ${it.type}${library.selectedDayItems.includes(it.id) ? " selected" : ""}`}
                                onClick={() => library.toggleSelectedDayItem(it.id)}
                              >
                                <div className="item-topline">
                                  <div className="item-meta">
                                    <span className="tag">{it.type === "custom" && it.custom_category_name ? `${it.custom_category_emoji ?? "✦"} ${it.custom_category_name}` : TYPE_LABELS[it.type]}</span>
                                  </div>
                                  <div className="item-date">{formatShortDate(getItemDateValue(it))}</div>
                                </div>
                                <div className="item-body">
                                  {it.creator && <div className="item-title">{it.creator}</div>}
                                  <div className="item-creator">{it.title}</div>
                                </div>
                                {library.selectedDayItems.includes(it.id) ? <div className="item-selected-badge">выбрано</div> : null}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="empty">в этот день пока пусто</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {library.calendarMoveMode && library.pendingMoveTarget ? (
                  <div className="day-modal-backdrop" onClick={() => library.setPendingMoveTargetKey(null)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="card-title" style={{ marginBottom: 10 }}>перенести на другой день?</div>
                      <div className="vibe-helper" style={{ marginBottom: 14 }}>
                        перенесем {library.selectedDayItems.length} {library.selectedDayItems.length === 1 ? "айтем" : library.selectedDayItems.length < 5 ? "айтема" : "айтемов"} на{" "}
                        {library.pendingMoveTarget.date.toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}.
                      </div>
                      <div className="day-action-row">
                        <button type="button" className="btn" onClick={library.moveSelectedItemsToDay}>да, перенести</button>
                        <button type="button" className="btn btn-outline" onClick={() => library.setPendingMoveTargetKey(null)}>не сейчас</button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="items-grid">
                {library.filteredItems.map((it) => (
                  <div key={String(it.id)} className={`item-card ${it.type}`}>
                    <div className="item-topline">
                      <div className="item-meta">
                        <span className="tag">{it.type === "custom" && it.custom_category_name ? `${it.custom_category_emoji ?? "✦"} ${it.custom_category_name}` : TYPE_LABELS[it.type]}</span>
                      </div>
                      <div className="item-date">{formatShortDate(getItemDateValue(it))}</div>
                    </div>
                    <div className="item-body">
                      {it.creator && <div className="item-title">{it.creator}</div>}
                      <div className="item-creator">{it.title}</div>
                    </div>
                    <button
                      className="delete-btn"
                      onClick={() => deleteItem(it.id)}
                      disabled={deletingId === it.id}
                      title="удалить"
                    >
                      {deletingId === it.id ? "…" : "×"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setTab("add")}>
                + добавить контент
              </button>
            </div>
          </>
        )}

        {/* VIBE */}
        {tab === "vibe" && (
          <div className="card">
            <div className="card-title">вайбчек</div>
            <div className="vibe-section vibe-blue">
              <div className="vibe-helper">
                {countsUnknown
                  ? "считаем, что у тебя в библиотеке..."
                  : `сейчас в библиотеке ${counts.total}: музыка ${counts.music}, книги ${counts.books}, фильмы ${counts.movies}.`}
              </div>
              <div className="vibe-meta">
                быстрый вайбчек — это короткая прожарка по неожиданным сочетаниям в библиотеке.
              </div>
              <button
                className="btn btn-outline"
                style={{ background: "#ffffff", borderColor: "#ffffff" }}
                onClick={vibe.runVibeCheck}
                disabled={vibe.vibeLoading || countsUnknown || counts.total === 0}
              >
                {vibe.vibeLoading
                  ? "анализирую..."
                  : countsUnknown
                    ? "загружаем библиотеку..."
                    : counts.total === 0
                    ? "сначала добавь контент"
                    : vibe.summary || vibe.vibeDuel
                      ? "ещё раз!"
                      : "провести вайбчек"}
              </button>
            </div>

            {vibe.vibeError && <div className="error">{vibe.vibeError}</div>}
            {vibe.vibeDuel && (
              <div className="vibe-section vibe-pink">
                <div className="card-title" style={{ marginBottom: 4 }}>какой точнее?</div>
                <div className="vibe-helper" style={{ marginBottom: 12 }}>
                  сегодня два варианта. выбери тот, что ближе — второй мы больше не покажем.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {vibe.vibeDuel.variants.map((variant, index) => (
                    <div key={variant.runId ?? index} style={{ background: "#fff", borderRadius: 12, padding: 14 }}>
                      <VibeResult summary={variant.summary} />
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ width: "100%", marginTop: 10 }}
                        onClick={() => void vibe.pickDuelWinner(variant)}
                      >
                        выбрать этот
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {vibe.summary && (
              <div className="vibe-section vibe-pink">
                <div className="card-title" style={{ marginBottom: 10 }}>свежий срез</div>
                <VibeResult summary={vibe.summary} />
                <button
                  className="btn btn-outline"
                  style={{marginTop:12,fontSize:13,display:"flex",alignItems:"center",gap:6,width:"100%"}}
                  onClick={() => shareVibeCard(vibe.summary, "vibe")}
                >
                  ↗ поделиться вайбчеком
                </button>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => void vibe.rateVibeCheck("good")} disabled={Boolean(vibe.vibeFeedback)}>
                    {vibe.vibeFeedback === "good" ? "запомнили" : "нормально"}
                  </button>
                  <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => void vibe.rateVibeCheck("bad")} disabled={Boolean(vibe.vibeFeedback)}>
                    {vibe.vibeFeedback === "bad" ? "перепишем" : "плохо"}
                  </button>
                </div>
              </div>
            )}

            <button
              className="btn btn-outline"
              style={{marginTop: 12}}
              onClick={vibe.runMentalAge}
              disabled={vibe.mentalAgeLoading || countsUnknown || counts.total === 0}
            >
              {vibe.mentalAgeLoading ? "считаю..." : "рассчитать ментальный возраст"}
            </button>

            {vibe.mentalAge && (
              <div style={{marginTop:16,padding:"16px",background:"#fff",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                {vibe.mentalAge.split("\n").map((line, i) => (
                  <div key={i} style={{
                    fontFamily: i === 0 ? "'Unbounded', sans-serif" : "inherit",
                    fontWeight: i === 0 ? 700 : 400,
                    fontSize: i === 0 ? 18 : 14,
                    color: i === 0 ? "#1a1a1a" : "#555",
                    marginTop: i === 0 ? 0 : 8,
                    lineHeight: 1.5,
                  }}>{line}</div>
                ))}
              </div>
            )}

            {false && <div className="vibe-section vibe-green">
              <div className="card-title" style={{ marginBottom: 10 }}>вайбчек без прикола</div>
              <div className="vibe-helper">
                серьезный срез периода: что у тебя сейчас по темам, эмоциональному фону и куда все это движется.
              </div>

              {/* Кнопка запуска — если есть доступ */}
              {(vibe.deepVibeAccess === "free" || vibe.deepVibeAccess === "forever" || vibe.deepVibeAccess === "paid") && (
                <div>
                  {vibe.deepVibeAccess === "free" && vibe.deepVibeUsesLeft !== null && (
                    <div style={{textAlign:"center",fontSize:12,color:"#aaa",marginBottom:10}}>
                      осталось бесплатных: {vibe.deepVibeUsesLeft} из 3
                    </div>
                  )}
                  {vibe.deepVibeAccess === "forever" && (
                    <div style={{textAlign:"center",fontSize:12,color:"#aaa",marginBottom:10}}>
                      вечный доступ
                    </div>
                  )}
                  <button
                    className="btn"
                    style={{background:"#1a1a1a",color:"#fff",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
                    onClick={vibe.runDeepVibe}
                    disabled={vibe.deepVibeLoading || counts.total === 0}
                  >
                    {vibe.deepVibeLoading ? "анализирую..." : "вайбчек без прикола"}
                  </button>
                </div>
              )}

              {/* Нет доступа — показываем кнопки покупки */}
              {vibe.deepVibeAccess === "none" && (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <button
                    className="btn"
                    style={{background:"#1a1a1a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
                    onClick={vibe.buyDeepVibeOnce}
                    disabled={counts.total === 0}
                  >
                    ✦ один анализ — 5 ★
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,borderColor:"#1a1a1a"}}
                    onClick={vibe.buyDeepVibeForever}
                    disabled={counts.total === 0}
                  >
                    ✦ вечный доступ — 200 ★
                  </button>
                  <div style={{fontSize:11,color:"#aaa",textAlign:"center"}}>оплата через Telegram Stars</div>
                </div>
              )}

              {/* Результат с markdown */}
              {vibe.deepVibeResult && (
                <div style={{marginTop:16,padding:"18px",background:"#fff",borderRadius:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",fontSize:14,lineHeight:1.8,color:"#333"}}>
                  <MarkdownText text={vibe.deepVibeResult} />
                  <button
                    className="btn btn-outline"
                    style={{marginTop:14,fontSize:13,display:"flex",alignItems:"center",gap:6,width:"100%"}}
                    onClick={() => shareVibeCard(vibe.deepVibeResult, "deep")}
                  >
                    ↗ поделиться
                  </button>
                </div>
              )}
            </div>}

          </div>
        )}

        {imports.selectedImportService && (
          <div className="service-modal-backdrop" onClick={() => imports.setSelectedImportService(null)}>
            <div className="service-modal" onClick={(e) => e.stopPropagation()}>
              <div className="service-modal-top">
                <div className="service-modal-title">{imports.selectedImportService.title}</div>
                <button className="btn btn-outline btn-sm" onClick={() => imports.setSelectedImportService(null)}>
                  закрыть
                </button>
              </div>

              {imports.selectedImportService.instructions && (
                <div className="service-modal-copy">
                  <ul>
                    {imports.selectedImportService.instructions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              {imports.selectedImportService.id === "lastfm" && (
                <div className="input-group" style={{ marginTop: 12 }}>
                  {imports.connectedProfiles.lastfm ? (
                    <div style={{ marginBottom: 10, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                      last.fm подключен: {imports.connectedProfiles.lastfm.profile}
                    </div>
                  ) : null}
                  <div className="input-label">username last.fm</div>
                  <input
                    className="input"
                    placeholder="например: nastyad"
                    value={imports.lastfmProfileInput}
                    onChange={(e) => imports.setLastfmProfileInput(e.target.value)}
                  />
                  <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                    импортируем recent tracks из публичного профиля last.fm
                  </div>
                  {imports.importLoading ? (
                    <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                      {imports.importStatus || "смотрим профиль..."}
                    </div>
                  ) : null}
                  {imports.connectedProfiles.lastfm ? (
                    <button
                      className="btn btn-outline"
                      style={{ marginTop: 12 }}
                      onClick={() => imports.disconnectConnectedProfile("lastfm", false)}
                      disabled={imports.importLoading}
                    >
                      отвязать last.fm
                    </button>
                  ) : null}
                </div>
              )}

              {imports.selectedImportService.id === "letterboxd" && (
                <div className="input-group" style={{ marginTop: 12 }}>
                  {imports.connectedProfiles.letterboxd ? (
                    <div style={{ marginBottom: 10, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                      letterboxd подключен: {imports.connectedProfiles.letterboxd.profile}
                    </div>
                  ) : null}
                  <div className="input-label">username или ссылка на profile</div>
                  <input
                    className="input"
                    placeholder="например: letterboxd.com/nastyad/"
                    value={imports.letterboxdProfileInput}
                    onChange={(e) => imports.setLetterboxdProfileInput(e.target.value)}
                  />
                  <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                    public profile beta: лучше всего работает с открытым профилем
                  </div>
                  {imports.importLoading ? (
                    <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                      {imports.importStatus || "смотрим профиль..."}
                    </div>
                  ) : null}
                  {imports.connectedProfiles.letterboxd ? (
                    <>
                      <button
                        className="btn btn-outline"
                        style={{ marginTop: 12 }}
                        onClick={() => imports.disconnectConnectedProfile("letterboxd", false)}
                        disabled={imports.importLoading}
                      >
                        отвязать letterboxd
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ marginTop: 12 }}
                        onClick={() => imports.disconnectConnectedProfile("letterboxd", true)}
                        disabled={imports.importLoading}
                      >
                        отвязать и убрать импорт
                      </button>
                    </>
                  ) : null}
                </div>
              )}

              {imports.selectedImportService.id === "lastfm" ? (
                <>
                  <button
                    className="btn"
                    style={{ marginTop: 16 }}
                    onClick={imports.importLastfmProfileWeb}
                    disabled={imports.importLoading}
                  >
                    импортировать профиль
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ marginTop: 12 }}
                    onClick={imports.confirmCsvImport}
                    disabled={imports.importLoading}
                  >
                    или выбрать csv
                  </button>
                </>
              ) : imports.selectedImportService.id === "letterboxd" ? (
                <>
                  <button
                    className="btn"
                    style={{ marginTop: 16 }}
                    onClick={imports.importLetterboxdProfileWeb}
                    disabled={imports.importLoading}
                  >
                    импортировать профиль
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ marginTop: 12 }}
                    onClick={imports.confirmCsvImport}
                    disabled={imports.importLoading}
                  >
                    или выбрать csv
                  </button>
                </>
              ) : (
                <button
                  className="btn"
                  style={{ marginTop: 16 }}
                  onClick={imports.confirmCsvImport}
                  disabled={imports.importLoading}
                >
                  {imports.selectedImportService.actionLabel ?? "выбрать файл"}
                </button>
              )}

              {imports.selectedImportService.id === "spotify" && imports.spotifyConnected ? (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                    spotify подключен{imports.spotifyProfileName ? `: ${imports.spotifyProfileName}` : ""}
                  </div>
                  <button className="btn btn-outline" onClick={() => imports.disconnectSpotify(false)} disabled={imports.spotifySyncing}>
                    отвязать spotify
                  </button>
                  <button className="btn btn-outline" onClick={() => imports.disconnectSpotify(true)} disabled={imports.spotifySyncing}>
                    отвязать и убрать импорт
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className={`nav${isAdmin ? " admin-nav" : ""}`}>
        {([
          ["profile", "◉", "профиль"],
          ["library", "▦", "библиотека"],
        ] as [Tab, string, string][]).map(([t, icon, label]) => (
          <button
            key={t}
            className={`nav-btn${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </button>
        ))}
        <button
          className={`nav-btn add-btn${tab === "add" ? " active" : ""}`}
          onClick={() => setTab("add")}
        >
          <span className="nav-icon">+</span>
          <span className="nav-label-spacer" aria-hidden="true">добавить</span>
        </button>
        <button
          className={`nav-btn vibe-nav${tab === "vibe" ? " active" : ""}`}
          onClick={() => setTab("vibe")}

        >
          <span className="nav-icon" style={{display:"flex",alignItems:"center"}}><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAANp0lEQVR4nK2Ye3BdR3nAf9/unvvSy7IelixZtuWXLCcOwUmMk4BiYoITJjTjIvHKhFJmQmhhmClMh6ZQRUyY0tLpMDBQCkOmtAm0No/ShCEGQiLCJCR1Ak6c+Ems2PFTtiTrSvdxztn9+odkx44VICU79849Z+6e3d/37fc88NqH0I8F3Cu+5rw5FpA5nrX/j/1e0zAX3F2McA7MOceb175taU/XpeuuvfT6blU9O9v29/e/mgAXjT9o0nmb+0wmw8ru3r6TJ06sSELa5ZwrRc6e6Ghb/ORTzz7+nLWWlZ0rbz5dOf1xKfDmQnOUKU+WY6lk9tW5eV/a/9u93/DBX7Dm6wFoAb/x2hvWHTj2/D/GtvzWxoX1NMw3hKCMHp2iekoSl+T+K2jaqg3JDUvfOJ+WFTVk81mNKyrF09McfOw0/lT2nlxa9/3dL/7mQRHxzJxK+GMArRjx61e9ZdPJuhe/u2hDoaGlrTZkCoVgg0F9IPEJpenYxVMJiFLblg35qKCVojeSePFeVHKiSsroyKg5tTclFKNn6kzTZ3+9c8f3fPCvqsnfB+gQ0t7VvR/1ddNf7tnURn173penqtaXwacBMWBTCxYlwoOIVbW+GjAZQ5BAekYIQXE1hlxtJjUOc3J0zOwfPokZzf/lyMjIV1V1TsjfBWgBv27ttesnOPSL3i3NrqGxnmoxNd57ooJDnEIqxOVAKAsEJfEx1WqFXMHiMnl82YNVXINFy4ETI6cpUEv/+9/ri9NFvfeL/2PG9kz0vTR6+Jc6h02audkwgB/82GD9aGXk251vrc80zq9TnyTG5gyZWoexgp9SKqcgKVeRbEyxOEFO67h+/c30dFwOIeBzFXp6e1heu5bK7gaW8Cae2X6U408m9pNb7pZvfPkes+SS7ru1szO/tX/rnCBzaTXoPs1+83v3/Gfzqkx35+JmX43VqkAwHp8EyhOe0mQM2TI5V4c72siZZ7M8+K9P4F/McfcdX+GOLZ/glmvfx9+8659wR1v41UM7KE6M8+m/+wzf3fYddu/aZa+87Ar/kY039l3RUP9vA9sG/OArmNxcRz54+2Bh9cDKB7reWrOxZVGj90lqM85RoIAxhqApRYmhOcOfbnwvP/zaL3j80adobWvic3d/jvvuu5clXct4/63vO7fwmYlxKqUK+VwN93zpq1zSthj/wotMnZiU/tXr9MrPrF471tTWdNWmq8buAhERnQvQqKou6uj6YtfG+o1L1y9IklNp1JZtZGVuMe1RC1mTJWmocrJ6mjWX97HhylvY+oWfc+TwIXpWLeehn/yMFw6MsG//Xp7Y/TAHTu7jmt6NbLzxGn70sx9QYoz165by7g2baUk8ZmzKlETT5U0dPUdLU38rIn+lDz/sgPRCwEEMQ/i+vneszq2yH+q4rMGHinft9U1cUdvLpfkV1NoCDosPCdOZThqnGjh+cC9vettlbN/xIJ1rFnL/A/9NdkngkNnFl37wOFP2NA/t/D6ZqMAbP7iMgng2t69nca6FgrcYF2E0CHHJW0muRoBHHjkXF88B9j2CGYZwfPTg1R3X1JtsznmqIq3Zepa4NmpNgZwKxliCGBJJOHx4D7v2/Zjp4n4+fPMyismT3PLuHqbzMOFfwjhDjallOi4RT5Vp85ZFqaXh8HGkaR5xQw5jskBQMjkXV9Ofo8CaNXIR4PAwQQfVXPrQ8tvmdzSAN6gEpnyF8fQMTZlmDAYJKR5ICFRsoDA1xornjlGpGqJcDqaqVCWllHWkTkBjMilkg1CoBkzV8xLPcuLYKD3dq7m0+/rEpT46MTn2ha53bb5z69atVgYGzoUaOe9XN/Ox7LEbHty3elNrl1gbRL3JSJ6uzAJWFhaxIGqiQA2pxoyHKX4bH2H09AirDk4Sj8eU4xTrwISAU0GMEBuwQVEBT6AaLFaUzlpHEkSL2bUyfrK441MPbN0AeJ2B0TkBDY61b196YM3GtmUa2aAEowScWvImT63NkdMCnphpSkylFUq2wvxpZdkYNE6nZEtKkio+eFRBVDBicNZibCAygs8ZxhpCGN5zmKeeztw5cuTQl7du7a8ODGwLnAd3PqAF8Zcs6xmI25JvrdvSGiFiCQZEUFH07GMaQBRBmPkIqCWoUpsE5lVT8rGQTw1RCIiCCqRiiV2glK0yUciGY5MFc+iRytN7n/jlukryspJeEVWQs19VWLjoxmcn5t3Ru2J98Cu6/8Pma46CFwIRQUHFnFtj5iFQZgQwCl5m5A2ks5KniAEjMwfnk3kUi50cP/oWjhy7IkwfHPFX97zw9aFPtH/2yJH24sDA1ZU5NNhvrf2ev/mmGz+y/ZkNX9Wln/DOOFtX9zxdi7ezsOUJsoVjOJOgGASDIqAzsDpzByIIHpEwo2QJ+LSGSpqnNLWIU+OXMHr6DUyNr6JSbcZGBl+dCGFyt7mi9Sf/8uTwZ/+iGr/Lwjb/CkCVbMZqx9KBpw4VPnl5fsG6IJrakFhEEnJ1LzKv5hDzG/ZSV7+fXGYS41KsTGMMaIjwGlCfIUkLlJNm4koj06V2SsV2SnELxXInodo4YxIGjAmgHiTSpDLhm/2jpfdvGt3w90Mfep7BQcPQUDgPEDZt3LTlV4fe9t3QeYdGJmO8KBiLYCEY1EMwKTaq4NwUxlSJSBAbo8ERNIsGh/cFfMgRgsUHi4hDRRHxOLGIMGvLcs6eDbEvF4/ZxZlvfWPPL+76sNyFMCQvAxoD7Yv+5JETdXf25dqv8v7MQSs183FRA4GYEBcRk8HZGgIGhVnvvNjVRMCoomZ2fZUZTSGIvDKrzlhrkFipphTO/HRy+z/UdLzh7W8v9/UNmuuuIwwNDQXnfZ9rWVS7wNV0ENKKBDG4KI8SQIUwPY6tXUAwggkv2xuiF/mdnrXFYGesU0GxGHm1qk5QMhIiF+JMe+Hr2w+8E/jO8PBQGB6emeA2vOHY+lgvWy7ZGiWZMuJmO0oBjScJ4rCuZrZrkPN4ZI6gcB7orByca+bmBjSqiHVapTMa3vl4/wffedXOQ9WFKwqZ8oH779/+nBs/U6r1tt2ZqKB++jAmUzuzchB8ZQpxDqMBM+cRvcq2MivAuevfiYhRtT5bw+h4uG7nGd1ZXzftxqcrlQ984AOXG5E44CyKw4U8NtOMiiBSQbzHZuchr1p4vx5DCQjWZDHBNebyBZf6UpJ1UW5sbOxjbiaJCKRVquEI2TRg0xqqsQdjyEa1FzrE6zyCKmKhUj5KKy+qsR6TYpMQtFyubnGCqGpZI6myas0OWlp3kKY17N37Zs6UrkMlIDq3BpVwQVP7WjStBFQ8KhGhWsQQYeuWiIRfIUSSGmFystjmcvnEUcxJNj+hK3oeJ1vYQ6o52jv2sHu/svdAP9acyxev2AICglFB5GxW+UNabUXxWDUkfhI/dZxMYTEumodULaBY8UzHZTU33bRif8aMHrOUxGlVfWrBG0YnLmOiuGTGb0VmWpmze6uiOpP4ouQYtvobQnqAEC5+QTDj94GzaVFR1IpC5NPKmKalE2QKC5BMBu8NAQsmEFRUjIj7/D8/9tv6zoUvTZWa2w8ef4d2dfxQJsYu46lnP0ppej5RpkpSKSLBYzJ1qItmK4WIDEdo1vso6P+SpLWMm1uZjvrwRjDBoKIE0ZmwidGZuFyWJB416eRLVjMFsg3deCOq3hNrewgYDbjgRDItC1p/4lKPzF8Usmni9fm97+PQC9dRSppI0jxRJgWJEMmR+nGYPjVT9rgIJEut3UGT/pysFFEF5x+gnFmD0hbEElBBQ0yalF1aKolU9tjM5K/JpU+fsv6FA96tvbQ60V5DqIhqlulab83CHCZUiYyttDa1/LVzFm3v5kxl6piYmsZwptyFGMUaAAsq2GwtJldL8EAaE0IRTUtk011kpUhicqhJifwYUh3VSjUxpnrEhOAhPU2uup+CHj5e40a2L5g3su1Nq4/t+Mq2kyf6N+5bOHI43xRLJSNJSU2uZ3nzvJWrS5NjPfl8/tv33nvvTgHktts+euWPHut4+EzdLflC03JEnCiKqJxndy/bYDAQ6SRtyedpjYepOofRKiYs5MD41fhk/LmM3feYBnM8a0zcu3Bq+zUrnzlw59cOjZ8rfFHh9wcwEfr7Ldu2+c033XbrE3uW/fv0vHf7QvNyAKsgQQWZLRMUx1nwyB+nyw9RH54lNQYR732lxhanpu97Ztfjf2YNabho+/7ZN6znSnsDg+f9/7z09Z2U1tZW7e3t1aGhoSAAfX197tFHh9MNGzb/+e7j6785XdiIrVkB+SaMy6ZGQAWxMw5sQEV0nCXxp2lMd5IYBybrK5NlOT1x5JaDBw/eD5uzsN4DDA4ShoaGlFfN3r9DheddG2MIG6++ftO+o3UfnPQdm4IsaU3zXXibwWQ7wbVhsgWsyWmQKu36ldAafixGc0Qm9idOnYiCz96wZ8+un/IHvD19rYBn79UI3H5Ld+vI2Mrug8fzN5bioqlSt8LbhZ1qG1fG0t1ipZbmhuO0RtuJ3BniYpHxYuXH73nPe7YMDQ3FzGjrj06SF4X9fvrtNgC2+dnGDVUwAsbA7bfe1Pb0rqULaxvr64rFI7f7cLhH3Rjqw5OfuvEzHx8YGojPCvrHws0J+PJQgbsEHjEwJdAdoFdh6IJ0YWYNNOgFbcTrVl78H1ZYi33lL2DVAAAAAElFTkSuQmCC" width="24" height="24" style={{imageRendering:"auto"}}/></span>
          вайбчек
        </button>
        {isAdmin && (
          <button
            className={`nav-btn${tab === "admin" ? " active" : ""}`}
            onClick={() => setTab("admin")}
          >
            <span className="nav-icon">📊</span>
            стата
          </button>
        )}
      </nav>
      {tab === "admin" && isAdmin && <AdminTab />}

      {/* Share Picker Modal — выбор контента */}
      {showSharePicker && (
        <div
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",padding:"0 0 0 0"}}
          onClick={() => setShowSharePicker(false)}
        >
          <div
            style={{background:"#f5f0e8",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"80vh",display:"flex",flexDirection:"column"}}
            onClick={e => e.stopPropagation()}
          >
            <div style={{padding:"20px 20px 12px",borderBottom:"1px solid #e8e3da"}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>выбери что показать на карточке</div>
              <div style={{fontSize:12,color:"#888"}}>выбрано: {sharePickerSelected.size} из {items.length}</div>
            </div>

            {/* Фильтры по типу */}
            <div style={{display:"flex",gap:8,padding:"10px 20px",borderBottom:"1px solid #e8e3da"}}>
              {(["music","book","movie"] as const).map(t => {
                const typeItems = items.filter(i => i.type === t);
                const allSelected = typeItems.every(i => sharePickerSelected.has(i.id));
                return (
                  <button key={t} className={`filter-btn${allSelected ? " active" : ""}`}
                    onClick={() => {
                      const ids = typeItems.map(i => i.id);
                      setSharePickerSelected(prev => {
                        const next = new Set(prev);
                        if (allSelected) ids.forEach(id => next.delete(id));
                        else ids.forEach(id => next.add(id));
                        return next;
                      });
                    }}
                  >
                    {t === "music" ? "♫ музыка" : t === "book" ? "📖 книги" : "🎬 фильмы"}
                  </button>
                );
              })}
              <button className="filter-btn" style={{marginLeft:"auto"}}
                onClick={() => setSharePickerSelected(new Set(items.map(i => i.id)))}
              >все</button>
            </div>

            {/* Список айтемов */}
            <div style={{overflowY:"auto",flex:1,padding:"8px 0"}}>
              {items.map(item => {
                const selected = sharePickerSelected.has(item.id);
                return (
                  <div key={item.id}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"10px 20px",cursor:"pointer",background:selected?"#ede7d9":"transparent"}}
                    onClick={() => setSharePickerSelected(prev => {
                      const next = new Set(prev);
                      selected ? next.delete(item.id) : next.add(item.id);
                      return next;
                    })}
                  >
                    <div style={{width:20,height:20,borderRadius:4,border:"1.5px solid #ccc",background:selected?"#1a1a1a":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {selected && <span style={{color:"#fff",fontSize:12}}>✓</span>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.title}</div>
                      {item.creator && <div style={{fontSize:12,color:"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.creator}</div>}
                    </div>
                    <div style={{fontSize:11,color:"#aaa",flexShrink:0}}>{item.type === "music" ? "♫" : item.type === "book" ? "📖" : "🎬"}</div>
                  </div>
                );
              })}
            </div>

            {/* Кнопка генерации */}
            <div style={{padding:"16px 20px 32px",borderTop:"1px solid #e8e3da"}}>
              <button
                className="btn"
                style={{background:"#1a1a1a",color:"#fff",width:"100%"}}
                disabled={sharePickerSelected.size === 0}
                onClick={async () => {
                  setShowSharePicker(false);
                  const selectedItems = items.filter(i => sharePickerSelected.has(i.id));
                  const dataUrl = await generateShareCard(items, sharePickerText, sharePickerType, selectedItems.length > 0 ? selectedItems : undefined);
                  setShareCardDataUrl(dataUrl);
                  setShowShareCard(true);
                }}
              >
                сгенерировать карточку →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Card Modal */}
      {showShareCard && shareCardDataUrl && (
        <div
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}
          onClick={() => setShowShareCard(false)}
        >
          <div
            style={{background:"#f5f0e8",borderRadius:20,overflow:"hidden",width:"100%",maxWidth:400,boxShadow:"0 8px 40px rgba(0,0,0,0.4)"}}
            onClick={e => e.stopPropagation()}
          >
            <img src={shareCardDataUrl} style={{width:"100%",display:"block"}} alt="share card" />
            <div style={{padding:"16px 20px 20px",display:"flex",flexDirection:"column",gap:10}}>
              <button
                className="btn"
                style={{background:"#1a1a1a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
                onClick={async () => {
                  const res = await fetch(shareCardDataUrl);
                  const blob = await res.blob();
                  const file = new File([blob], "everyyou.png", { type: "image/png" });
                  if (navigator.share && navigator.canShare?.({ files: [file] })) {
                    await navigator.share({ files: [file], text: "t.me/every_you_bot" });
                  } else {
                    const a = document.createElement("a");
                    a.href = shareCardDataUrl; a.download = "everyyou.png"; a.click();
                  }
                  fireAnalytics("vibecheck_shared", { runId: vibe.shareRunId, type: sharePickerType ?? null });
                }}
              >
                ↗ поделиться
              </button>
              <button
                className="btn btn-outline"
                style={{fontSize:13}}
                onClick={async () => {
                  const res = await fetch(shareCardDataUrl);
                  const blob = await res.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob); a.download = "everyyou.png"; a.click();
                }}
              >
                ↓ сохранить в галерею
              </button>
              <button
                className="btn btn-outline"
                style={{fontSize:13,color:"#999",borderColor:"#ddd"}}
                onClick={() => setShowShareCard(false)}
              >
                закрыть
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

function MarkdownText({ text }: { text: string }) {
  // Рендерим **жирный** и абзацы
  const paragraphs = text.split(/\n\n+/);
  return (
    <div>
      {paragraphs.map((para, i) => {
        const parts = para.split(/\*\*(.+?)\*\*/g);
        return (
          <p key={i} style={{margin: i === 0 ? 0 : "12px 0 0 0"}}>
            {parts.map((part, j) =>
              j % 2 === 1 ? <strong key={j}>{part}</strong> : part
            )}
          </p>
        );
      })}
    </div>
  );
}

function VibeResult({ summary }: { summary: string }) {
  return (
    <div>
      <div className="vibe-text">{summary.trim()}</div>
    </div>
  );
}

const MAX_LABEL_BATCHES = 50;

function adminHeaders() {
  return { "x-telegram-init-data": (window as any).Telegram?.WebApp?.initData || "" };
}

async function labelBatch() {
  const res = await fetch("/api/admin/vibe-forms", { method: "POST", headers: adminHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `ошибка ${res.status}`);
  return json as { labeled: number; remaining: number };
}

function buttonLabel(running: boolean, unlabeled: number | null) {
  if (running) return "размечаю...";
  return unlabeled === 0 ? "всё размечено" : "разметить";
}

function FormLabelingPanel() {
  const [unlabeled, setUnlabeled] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/admin/vibe-forms?limit=1", { headers: adminHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setUnlabeled(json?.remaining ?? 0))
      .catch(() => undefined);
  }, []);

  async function run() {
    setRunning(true);
    setStatus("размечаю...");
    let labeled = 0;
    try {
      for (let batch = 0; batch < MAX_LABEL_BATCHES; batch += 1) {
        const result = await labelBatch();
        labeled += result.labeled;
        setUnlabeled(result.remaining);
        setStatus(`размечено ${labeled}, осталось ${result.remaining}`);
        if (!result.labeled || !result.remaining) return;
      }
      setStatus(`размечено ${labeled}, лимит за один заход исчерпан`);
    } catch (error: any) {
      setStatus(error?.message ?? "не удалось разметить");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{background:"#fff",borderRadius:12,padding:"16px",marginBottom:24,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
      <div style={{fontSize:12,color:"#888",marginBottom:4}}>🏷 вайбчеков без разметки</div>
      <div style={{fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:22,marginBottom:10}}>
        {unlabeled ?? "—"}
      </div>
      <button
        className="btn btn-outline btn-sm"
        style={{width:"100%"}}
        onClick={() => void run()}
        disabled={running || unlabeled === 0}
      >
        {buttonLabel(running, unlabeled)}
      </button>
      {status && <div style={{fontSize:12,color:"#888",marginTop:8}}>{status}</div>}
    </div>
  );
}

function AdminTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  useEffect(() => {
    async function load() {
      const headers = adminHeaders();
      try {
        const [statsRes, topRes] = await Promise.all([
          fetch("/api/admin/stats", { headers }),
          fetch("/api/admin/top", { headers }),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (topRes.ok) setTopUsers(await topRes.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div style={{padding:"32px",textAlign:"center",color:"#888"}}>загружаю...</div>;
  if (!stats) return <div style={{padding:"32px",textAlign:"center",color:"#888"}}>ошибка загрузки</div>;

  return (
    <div style={{padding:"24px 16px",maxWidth:480,margin:"0 auto"}}>
      <div style={{fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:18,marginBottom:24}}>статистика</div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
        {[
          ["👤 пользователей", stats.total_users],
          ["📦 айтемов всего", stats.total_items],
          ["🎵 музыка", stats.music],
          ["📚 книги", stats.books],
          ["🎬 фильмы", stats.movies],
          ["📅 за сегодня", stats.today],
        ].map(([label, val]) => (
          <div key={String(label)} style={{background:"#fff",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
            <div style={{fontSize:12,color:"#888",marginBottom:4}}>{label}</div>
            <div style={{fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:22}}>{val}</div>
          </div>
        ))}
      </div>

      <FormLabelingPanel />

      {topUsers.length > 0 && (
        <>
          <div style={{fontWeight:600,fontSize:13,color:"#888",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>топ пользователей</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {topUsers.map((u: any, i: number) => (
              <div key={u.tg_user_id} style={{background:"#fff",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                <span style={{color:"#888",fontSize:13}}>#{i+1} &nbsp;<span style={{color:"#1a1a1a",fontWeight:500}}>{u.tg_user_id}</span></span>
                <span style={{fontFamily:"'Unbounded',sans-serif",fontWeight:700}}>{u.count} айт.</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

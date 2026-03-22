"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseImportedFile } from "@/apps/mobile/lib/fileImports";

type Tab = "home" | "add" | "library" | "vibe" | "admin";

const ADMIN_TG_ID = 394657396; // espritdlparesse
type ItemType = "music" | "book" | "movie" | "custom";
type ItemSource =
  | "spotify"
  | "goodreads"
  | "letterboxd"
  | "manual"
  | "livelib"
  | "import_spotify"
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
    setIdx(0);
    setDisplayed("");
    setPhase("typing");
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
        setIdx((i) => (i + 1) % examples.length);
        setPhase("typing");
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

export default function Page() {
  const [tab, setTab] = useState<Tab>("home");
  const [libraryView, setLibraryView] = useState<"tiles" | "calendar">("tiles");
  const [helloName, setHelloName] = useState("привет!");
  const [tgUserId, setTgUserId] = useState<number | null>(null);

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
    setTelegramLinkCode(code);
    setTelegramLinkStatus("код из qr уже подставили");
    void linkMobileAccount(code);
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
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [shareCardDataUrl, setShareCardDataUrl] = useState<string | null>(null);
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [sharePickerSelected, setSharePickerSelected] = useState<Set<string | number>>(new Set());
  const [sharePickerText, setSharePickerText] = useState<string | undefined>(undefined);
  const [sharePickerType, setSharePickerType] = useState<"vibe" | "deep" | undefined>(undefined);
  const [spotifySyncing, setSpotifySyncing] = useState(false);
  const [telegramLinkCode, setTelegramLinkCode] = useState("");
  const [telegramLinkLoading, setTelegramLinkLoading] = useState(false);
  const [telegramLinkStatus, setTelegramLinkStatus] = useState("");
  const [telegramLinkSuccess, setTelegramLinkSuccess] = useState(false);
  const autoLinkHandledRef = useRef(false);

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

  useEffect(() => { loadLibrary(); loadCustomCategories(); fetchDeepVibeAccess(); }, []);

  const counts = useMemo(() => ({
    total: items.length,
    music: items.filter((i) => i.type === "music").length,
    books: items.filter((i) => i.type === "book").length,
    movies: items.filter((i) => i.type === "movie" || (i.type as string) === "film").length,
  }), [items]);

  const headerAvatar = useMemo(() => {
    const raw = helloName.replace(/^привет,?\s*/i, "").trim();
    if (!raw || raw === "привет!") return "◐";
    const first = raw[0];
    return first ? first.toUpperCase() : "◐";
  }, [helloName]);

  // ===== Import =====
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

  async function importCsvPlatform(platform: Exclude<ImportPlatform, "spotify">, file: File) {
    setImportLoading(true);
    setImportError("");
    try {
      const text = await file.text();
      const drafts = parseImportedFile(platform, text);
      const result: ImportedItem[] = drafts.map((item) => ({
        type: item.type === "film" ? "movie" : item.type,
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
        type: item.type === "film" ? "movie" : item.type,
        source: item.source ?? "lastfm",
        title: item.title,
        creator: item.authorOrArtist ?? "",
        consumedAt: typeof item.consumedAt === "number" ? item.consumedAt : undefined,
        timeOrigin: item.timeOrigin ?? undefined,
      }));
      setImported(result);
      setSelectedIdx(new Set(result.map((_: ImportedItem, i: number) => i)));
      setSelectedImportService(null);
      setLastfmProfileInput("");
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
        type: item.type === "film" ? "movie" : item.type,
        source: item.source ?? "letterboxd",
        title: item.title,
        creator: item.authorOrArtist ?? "",
        consumedAt: typeof item.consumedAt === "number" ? item.consumedAt : undefined,
        timeOrigin: item.timeOrigin ?? undefined,
      }));
      setImported(result);
      setSelectedIdx(new Set(result.map((_: ImportedItem, i: number) => i)));
      setSelectedImportService(null);
      setLetterboxdProfileInput("");
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
  const [summary, setSummary] = useState("");
  const [vibeLoading, setVibeLoading] = useState(false);
  const [vibeError, setVibeError] = useState("");
  const [mentalAge, setMentalAge] = useState("");
  const [mentalAgeLoading, setMentalAgeLoading] = useState(false);
  const [deepVibeResult, setDeepVibeResult] = useState("");
  const [deepVibeLoading, setDeepVibeLoading] = useState(false);
  const [deepVibeAccess, setDeepVibeAccess] = useState<"free"|"paid"|"forever"|"none"|null>(null);
  const [deepVibeUsesLeft, setDeepVibeUsesLeft] = useState<number|null>(null);

  async function checkSpotify() {
    try {
      const res = await fetch("/api/spotify/sync", {
        headers: { "x-telegram-init-data": getTgInitData() },
      });
      const json = await safeJson(res);
      setSpotifyConnected(json?.connected ?? false);
    } catch { setSpotifyConnected(false); }
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

  async function runVibeCheck() {
    setVibeLoading(true); setVibeError(""); setSummary("");
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "x-telegram-init-data": getTgInitData() },
      });
      const json = await safeJson(res);
      if (!res.ok) { setVibeError(json?.error ?? "Ошибка"); return; }
      setSummary(json?.summary ?? "");
    } catch (e: any) {
      setVibeError(e?.message ?? "Network error");
    } finally {
      setVibeLoading(false);
    }
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

  // Генерируем карточку по текущему состоянию приложения
  async function generateShareCard(text?: string, type?: "vibe" | "deep", customItems?: DbItem[]): Promise<string> {
    const canvas = document.createElement("canvas");
    const W = 1080, H = 1080;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // Фон белый
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Тонкая рамка
    ctx.strokeStyle = "#e8e8e8";
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    // Логотип — тонкий serif
    ctx.fillStyle = "#000000";
    ctx.font = "300 80px Georgia, serif";
    ctx.fillText("every you", 80, 150);

    // Подпись типа
    ctx.fillStyle = "#999";
    ctx.font = "28px -apple-system, sans-serif";
    const label = type === "deep" ? "вайбчек без прикола" : type === "vibe" ? "вайбчек" : "моя библиотека";
    ctx.fillText(label.toUpperCase(), 80, 195);

    // Разделитель
    ctx.fillStyle = "#000000";
    ctx.fillRect(80, 218, W - 160, 1);

    if (text) {
      // Режим вайбчека — выводим текст
      ctx.fillStyle = "#000000";
      ctx.font = "300 38px Georgia, serif";
      ctx.font = "italic 38px Georgia, serif";
      const clean = text.split("**").join("").split("\n\n").join("\n").trim();

      const words = clean.split(" ");
      let line = "";
      let y = 290;
      const maxWidth = W - 160;
      const lineH = 56;
      const maxY = H - 200;

      for (const word of words) {
        if (word === "\n" || word.includes("\n")) {
          ctx.fillText(line, 80, y);
          line = word.replace("\n", "");
          y += lineH;
          if (y > maxY) { ctx.fillText("...", 80, y); break; }
          continue;
        }
        const test = line + (line ? " " : "") + word;
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(line, 80, y);
          line = word;
          y += lineH;
          if (y > maxY) { ctx.fillText("...", 80, y); break; }
        } else { line = test; }
      }
      if (y <= maxY && line) ctx.fillText(line, 80, y);
    } else {
      // Режим библиотеки — показываем топ контент
      const sourceItems = customItems ?? items;
      const music = sourceItems.filter(i => i.type === "music").slice(0, 4);
      const books = sourceItems.filter(i => i.type === "book").slice(0, 3);
      const movies = sourceItems.filter(i => i.type === "movie" || (i.type as string) === "film").slice(0, 3);

      let y = 270;

      const drawSection = (emoji: string, title: string, list: typeof items) => {
        if (list.length === 0) return;
        ctx.fillStyle = "#999";
        ctx.font = "22px -apple-system, sans-serif";
        ctx.fillText(`${emoji}  ${title.toUpperCase()}`, 80, y);
        y += 40;
        ctx.fillStyle = "#000000";
        ctx.font = "300 34px Georgia, serif";
        for (const item of list) {
          const t = item.creator ? `${item.title} — ${item.creator}` : item.title;
          const short = t.length > 42 ? t.slice(0, 40) + "…" : t;
          ctx.fillText(short, 80, y);
          y += 50;
        }
        y += 20;
      };

      drawSection("♫", "музыка", music);
      drawSection("📖", "книги", books);
      drawSection("🎬", "фильмы", movies);
    }

    // Ссылка внизу
    ctx.fillStyle = "#999";
    ctx.font = "24px -apple-system, sans-serif";
    ctx.fillText("t.me/every_you_bot", 80, H - 70);

    ctx.fillStyle = "#000000";
    ctx.font = "300 36px Georgia";
    ctx.fillText("✦", W - 110, H - 65);

    return canvas.toDataURL("image/png");
  }

  function openSharePicker(text?: string, type?: "vibe" | "deep") {
    setSharePickerText(text);
    setSharePickerType(type);
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
      const dataUrl = await generateShareCard();
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
      fetchDeepVibeAccess();
    }
    if (tab === "add" && prevTabRef.current !== "add") {
      checkSpotify();
      if (deepVibeAccess === null) fetchDeepVibeAccess();
    }
    prevTabRef.current = tab;
  }, [tab]);

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

  // ===== Library filter =====
  const [libFilter, setLibFilter] = useState<ItemType | "all" | string>("all");
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const filteredItems = useMemo(() => {
    if (libFilter === "all") return items;
    if (libFilter === "music" || libFilter === "book" || libFilter === "movie") return items.filter(i => i.type === libFilter);
    // кастомная категория по id
    return items.filter(i => i.custom_category_id === libFilter);
  }, [items, libFilter]);

  const itemsByDay = useMemo(() => {
    const grouped = new Map<string, DbItem[]>();
    for (const item of filteredItems) {
      if (!item.created_at) continue;
      const key = dayKey(item.created_at);
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
    return null;
  }, [calendarDays, selectedDayKey]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #f7f5f1;
          color: #111111;
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
        }

        .app {
          max-width: 480px;
          margin: 0 auto;
          padding: 20px 16px 124px;
        }

        .header {
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .header-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .header-avatar {
          width: 52px;
          height: 52px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          border: 1px solid #e7e2d9;
          font-size: 22px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .header-copy {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .brand {
          font-family: 'DM Sans', sans-serif;
          font-size: 34px;
          font-weight: 900;
          letter-spacing: -0.06em;
          color: #111111;
          line-height: 1;
          text-transform: lowercase;
        }

        .greeting {
          font-size: 18px;
          font-weight: 400;
          color: #111111;
          letter-spacing: -0.02em;
          text-transform: lowercase;
        }

        .sync-line {
          font-size: 13px;
          line-height: 1.45;
          color: #6f6a63;
          text-transform: lowercase;
        }

        .nav {
          position: fixed;
          bottom: 16px; left: 16px; right: 16px;
          display: flex;
          background: rgba(255,255,255,0.92);
          z-index: 100;
          max-width: 480px;
          margin: 0 auto;
          border: 1px solid #e7e2d9;
          border-radius: 28px;
          backdrop-filter: blur(18px);
          box-shadow: 0 8px 30px rgba(17,17,17,0.08);
          padding: 10px 8px 12px;
          align-items: flex-end;
          gap: 2px;
        }

        .nav-btn {
          flex: 1;
          min-width: 0;
          padding: 6px 2px 0;
          border: none;
          background: transparent;
          color: #6f6a63;
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          transition: color 0.15s;
          letter-spacing: -0.02em;
          text-transform: lowercase;
          white-space: nowrap;
        }

        .nav-btn.active { color: #111111; }
        .nav-icon {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          line-height: 1;
          background: #f3f1ec;
        }
        .nav-btn.active .nav-icon {
          background: #111111;
          color: #ffffff;
        }
        .nav-btn.add-btn {
          flex: 0 0 72px;
          padding-top: 0;
        }
        .nav-btn.add-btn .nav-icon {
          width: 56px;
          height: 56px;
          background: #111111;
          color: #ffffff;
          font-size: 32px;
          box-shadow: 0 4px 18px rgba(17,17,17,0.18);
        }

        .card {
          background: #ffffff;
          border-radius: 32px;
          padding: 22px 18px;
          margin-bottom: 16px;
          border: 1px solid #e7e2d9;
          box-shadow: 0 4px 20px rgba(17,17,17,0.04);
        }

        .card-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.04em;
          margin-bottom: 12px;
          text-transform: lowercase;
        }

        .card-text {
          font-size: 16px;
          font-weight: 400;
          color: #3f3a35;
          line-height: 1.55;
          text-transform: lowercase;
        }

        .btn {
          width: 100%;
          padding: 16px 18px;
          border-radius: 999px;
          border: 1px solid #111111;
          background: #111111;
          color: #ffffff;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          letter-spacing: -0.02em;
          text-transform: lowercase;
        }
        .btn:disabled { opacity: 0.3; cursor: default; }
        .btn:active:not(:disabled) { transform: scale(0.99); }

        .btn-outline {
          background: #ffffff;
          border: 1px solid #e7e2d9;
          color: #111111;
        }

        .btn-sm {
          width: auto;
          padding: 8px 16px;
          font-size: 11px;
        }

        .stats {
          display: flex;
          gap: 10px;
          margin-bottom: 24px;
          border: none;
          flex-wrap: wrap;
        }

        .stat-pill {
          flex: 1 1 46%;
          background: #ffffff;
          padding: 16px 12px;
          text-align: center;
          border: 1px solid #e7e2d9;
          border-radius: 24px;
        }

        .stat-num {
          font-family: 'DM Sans', sans-serif;
          font-size: 26px;
          font-weight: 900;
          line-height: 1;
        }

        .stat-label {
          font-size: 11px;
          color: #6f6a63;
          margin-top: 6px;
          font-weight: 700;
          letter-spacing: -0.01em;
          text-transform: lowercase;
        }

        .actions { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }

        .type-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 20px;
          border: none;
        }

        .type-btn {
          flex: 1 1 30%;
          padding: 12px 10px;
          border: 1px solid #e7e2d9;
          border-radius: 999px;
          background: #ffffff;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
          letter-spacing: -0.02em;
          text-transform: lowercase;
        }
        .type-btn.active { background: #000000; color: #ffffff; }

        .input-group { margin-bottom: 14px; }
        .input-label {
          font-size: 12px;
          font-weight: 800;
          color: #6f6a63;
          text-transform: lowercase;
          margin-bottom: 6px;
        }

        .input {
          width: 100%;
          padding: 13px 14px;
          border: 1px solid #e7e2d9;
          border-radius: 20px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 300;
          color: #000000;
          background: #ffffff;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus { border-color: #000000; }
        .input::placeholder { color: #ccc; }

        /* Grid layout for items */
        .items-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .item-card {
          border-radius: 28px;
          padding: 18px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border: 1px solid rgba(17,17,17,0.1);
          position: relative;
          min-height: 182px;
        }

        .item-card.music { background: #FF79D5; }
        .item-card.book { background: #49DE4E; }
        .item-card.movie { background: #38C0FF; }
        .item-card.custom { background: #FFC804; }

        .item-card-selected {
          outline: 2px solid #111111;
        }

        .item-topline {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }

        .item-date {
          font-size: 11px;
          line-height: 1.2;
          color: rgba(17,17,17,0.45);
          text-align: right;
          text-transform: lowercase;
        }

        .item-body { flex: 1; min-width: 0; }

        .item-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.28;
          color: rgba(17,17,17,0.78);
          text-transform: lowercase;
        }

        .item-creator {
          font-family: 'DM Sans', sans-serif;
          font-size: 26px;
          font-weight: 900;
          line-height: 0.98;
          letter-spacing: -0.05em;
          color: #111111;
          text-transform: lowercase;
          overflow-wrap: anywhere;
          margin-top: auto;
        }

        .library-shell {
          background: #FFE2F4;
          border-radius: 28px;
          padding: 20px 18px;
          border: 1px solid rgba(17,17,17,0.08);
          margin-bottom: 16px;
        }

        .library-copy {
          font-size: 15px;
          line-height: 1.5;
          color: rgba(17,17,17,0.72);
          text-transform: lowercase;
          margin-bottom: 16px;
        }

        .library-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 16px;
        }

        .compact-toggle {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .compact-toggle .filter-btn {
          padding: 10px 16px;
        }

        .item-meta { display: flex; gap: 4px; margin-top: 2px; flex-wrap: wrap; }

        .tag {
          padding: 6px 10px;
          font-size: 10px;
          font-weight: 800;
          background: #ffffff;
          color: #111111;
          border-radius: 999px;
          border: 1px solid #e7e2d9;
          text-transform: lowercase;
        }

        .delete-btn {
          background: none;
          border: none;
          color: #ccc;
          cursor: pointer;
          font-size: 14px;
          padding: 0;
          position: absolute;
          top: 8px;
          right: 8px;
          line-height: 1;
          transition: color 0.15s;
        }
        .delete-btn:hover { color: #000; }

        .import-item {
          border: 1px solid #e7e2d9;
          border-radius: 20px;
          padding: 14px;
          margin-bottom: 8px;
          display: flex;
          gap: 10px;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .import-item.selected { border-color: #000000; background: #fafafa; }

        .filter-row {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .filter-btn {
          flex-shrink: 0;
          padding: 9px 14px;
          border: 1px solid #e7e2d9;
          border-radius: 999px;
          background: white;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          letter-spacing: -0.02em;
          text-transform: lowercase;
        }

        .filter-btn.active {
          background: #000000;
          border-color: #000000;
          color: white;
        }

        .error { color: #c0392b; font-size: 13px; margin-top: 10px; font-weight: 300; }
        .success { color: #27ae60; font-size: 13px; margin-top: 10px; font-weight: 400; }

        .vibe-text {
          margin-top: 20px;
          padding: 24px;
          background: #fafafa;
          border: 1px solid #e7e2d9;
          border-radius: 24px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 300;
          line-height: 1.8;
          white-space: pre-wrap;
          color: #222;
        }

        .divider {
          border: none;
          border-top: 1px solid #f0f0f0;
          margin: 20px 0;
        }

        .section-label {
          font-size: 12px;
          font-weight: 800;
          color: #8d867d;
          text-transform: lowercase;
          margin-bottom: 14px;
        }

        .empty {
          text-align: center;
          padding: 48px 20px;
          color: #ccc;
          font-size: 13px;
          font-weight: 300;
          letter-spacing: 0;
        }

        .home-tiles {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .home-tile {
          border-radius: 28px;
          padding: 18px;
          min-height: 208px;
          border: 1px solid rgba(17,17,17,0.08);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 16px;
          text-align: left;
        }

        .home-tile-label {
          font-size: 12px;
          font-weight: 700;
          color: rgba(17,17,17,0.5);
          text-transform: lowercase;
        }

        .home-tile-title {
          font-size: 20px;
          line-height: 1.02;
          font-weight: 900;
          color: #111111;
          letter-spacing: -0.05em;
          text-transform: lowercase;
        }

        .home-tile-copy {
          font-size: 15px;
          line-height: 1.5;
          color: rgba(17,17,17,0.68);
          text-transform: lowercase;
        }

        .tile-pink { background: #FF79D5; }
        .tile-green { background: #49DE4E; }
        .tile-blue { background: #38C0FF; }
        .tile-yellow { background: #FFC804; }

        .import-service-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 16px;
        }

        .import-service {
          background: #ffffff;
          border: 1px solid #e7e2d9;
          border-radius: 28px;
          padding: 18px 16px;
          text-align: left;
          min-height: 118px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 12px;
          position: relative;
        }

        .import-service-help {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          border: 1px solid #dcd4c6;
          background: #fff;
          color: #111;
          font-size: 15px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 2;
        }

        .import-service-main {
          all: unset;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 12px;
          flex: 1;
        }

        .import-service-title {
          font-size: 16px;
          font-weight: 900;
          color: #111111;
          letter-spacing: -0.04em;
        }

        .import-service-subtitle {
          font-size: 13px;
          line-height: 1.4;
          color: rgba(17,17,17,0.54);
          text-transform: lowercase;
        }

        .import-service-head {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .import-service-icon {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: rgba(17,17,17,0.06);
          color: #111111;
          font-size: 16px;
          font-weight: 900;
        }

        .service-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(17,17,17,0.58);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 300;
          padding: 16px;
        }

        .service-modal {
          width: 100%;
          max-width: 480px;
          background: #1d1f28;
          color: #ffffff;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 28px;
          padding: 18px;
          box-shadow: 0 16px 42px rgba(0,0,0,0.35);
        }

        .service-modal-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .service-modal-title {
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.05em;
        }

        .service-modal-copy {
          font-size: 14px;
          line-height: 1.65;
          color: rgba(255,255,255,0.94);
          text-transform: lowercase;
        }

        .service-modal-copy ul {
          padding-left: 18px;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .calendar-shell {
          background: #ffffff;
          border: 1px solid #e7e2d9;
          border-radius: 28px;
          padding: 18px;
          margin-bottom: 16px;
        }

        .calendar-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .calendar-title {
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.04em;
          text-transform: lowercase;
        }

        .calendar-arrow {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 1px solid #e7e2d9;
          background: #ffffff;
          font-size: 22px;
          cursor: pointer;
        }

        .calendar-weekdays {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 6px;
          margin-bottom: 8px;
        }

        .calendar-weekday {
          font-size: 11px;
          color: #8d867d;
          text-align: center;
          font-weight: 700;
          text-transform: lowercase;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 6px;
        }

        .calendar-day {
          min-height: 86px;
          border-radius: 18px;
          border: 1px solid #efe7db;
          background: #faf8f4;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          cursor: pointer;
          text-align: left;
        }

        .calendar-day.muted {
          opacity: 0.45;
        }

        .calendar-day.selected {
          border-color: #111111;
          background: #fff3fb;
        }

        .calendar-day-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
        }

        .calendar-day-number {
          font-size: 13px;
          font-weight: 800;
          color: #111111;
        }

        .calendar-day-count {
          font-size: 10px;
          color: #8d867d;
          font-weight: 700;
        }

        .calendar-chip {
          border-radius: 999px;
          padding: 4px 6px;
          font-size: 10px;
          font-weight: 700;
          color: #111111;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-transform: lowercase;
        }

        .calendar-more {
          font-size: 10px;
          color: #8d867d;
          font-weight: 700;
          text-transform: lowercase;
        }

        .day-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(17,17,17,0.58);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 400;
        }

        .day-modal {
          width: 100%;
          max-width: 480px;
          max-height: 80vh;
          overflow: hidden;
          background: #ffffff;
          border-radius: 32px;
          border: 1px solid #e7e2d9;
          box-shadow: 0 18px 50px rgba(0,0,0,0.24);
          display: flex;
          flex-direction: column;
        }

        .day-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 18px 14px;
          border-bottom: 1px solid #efe7db;
        }

        .day-modal-scroll {
          overflow-y: auto;
          padding: 16px 18px 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .day-week-strip {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 0 18px 14px;
          border-bottom: 1px solid #efe7db;
        }

        .day-week-pill {
          flex: 0 0 auto;
          border-radius: 18px;
          border: 1px solid #e7e2d9;
          background: #ffffff;
          padding: 8px 12px;
          min-width: 58px;
          text-align: center;
          cursor: pointer;
        }

        .day-week-pill.active {
          background: #111111;
          border-color: #111111;
          color: #ffffff;
        }

        .day-week-name {
          font-size: 10px;
          font-weight: 700;
          color: inherit;
          text-transform: lowercase;
        }

        .day-week-number {
          font-size: 16px;
          font-weight: 900;
          color: inherit;
          margin-top: 2px;
        }

        .vibe-section {
          border-radius: 28px;
          padding: 20px 18px;
          border: 1px solid rgba(17,17,17,0.08);
          margin-bottom: 20px;
        }

        .vibe-blue { background: #38C0FF; }
        .vibe-green { background: #49DE4E; }
        .vibe-pink { background: #FF79D5; }

        .vibe-helper {
          font-size: 15px;
          line-height: 1.55;
          color: rgba(17,17,17,0.88);
          text-transform: lowercase;
          margin-bottom: 12px;
        }

        .vibe-meta {
          font-size: 12px;
          line-height: 1.5;
          color: rgba(17,17,17,0.68);
          text-transform: lowercase;
          margin-bottom: 12px;
        }

        @media (max-width: 420px) {
          .app { padding-left: 14px; padding-right: 14px; }
          .brand { font-size: 30px; }
          .home-tiles { grid-template-columns: 1fr; }
          .home-tile { min-height: 180px; }
          .items-grid { grid-template-columns: 1fr; }
          .import-service-grid { grid-template-columns: 1fr; }
        }

      `}</style>

      <div className="app">
        <div className="header">
          <div className="header-row">
            <div className="header-avatar">{headerAvatar}</div>
            <div className="header-copy">
              <div className="brand">everyyou</div>
              <div className="greeting">{helloName}</div>
            </div>
          </div>
          <div className="sync-line">культурный таймлайн, который собирается сам.</div>
        </div>

        {/* HOME */}
        {tab === "home" && (
          <>
            <div className="stats">
              <div className="stat-pill">
                <div className="stat-num">{counts.total}</div>
                <div className="stat-label">всего</div>
              </div>
              <div className="stat-pill">
                <div className="stat-num">{counts.music}</div>
                <div className="stat-label">музыка</div>
              </div>
              <div className="stat-pill">
                <div className="stat-num">{counts.books}</div>
                <div className="stat-label">книги</div>
              </div>
              <div className="stat-pill">
                <div className="stat-num">{counts.movies}</div>
                <div className="stat-label">фильмы</div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">перенести в приложение</div>
              <p className="card-text">
                если у тебя уже есть библиотека в приложении на айфоне, открой этот же mini app по qr или просто введи код оттуда — и мы свяжем аккаунты.
              </p>
              <div className="input-group" style={{ marginTop: 16 }}>
                <div className="input-label">код из mobile</div>
                <input
                  className="input"
                  placeholder="например, A7K9QP"
                  value={telegramLinkCode}
                  onChange={(e) => setTelegramLinkCode(e.target.value.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect="off"
                />
              </div>
              <button
                className="btn"
                style={{ marginTop: 4 }}
                onClick={() => void linkMobileAccount()}
                disabled={telegramLinkLoading}
              >
                {telegramLinkLoading ? "связываем..." : "связать с приложением"}
              </button>
              {telegramLinkSuccess ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: "12px 14px",
                    borderRadius: 16,
                    background: "#dff7d9",
                    color: "#1f5a24",
                    fontSize: 14,
                    lineHeight: 1.5,
                    fontWeight: 600,
                  }}
                >
                  готово — теперь Telegram и приложение смотрят на одну библиотеку
                </div>
              ) : null}
              {telegramLinkStatus ? (
                <div style={{ marginTop: 10, fontSize: 13, color: "#666" }}>{telegramLinkStatus}</div>
              ) : null}
            </div>

            <div className="card">
              <div className="card-title">что это</div>
              <p className="card-text">
                EveryYou — место куда можно скидывать весь контент который ты потребляешь: музыку, книги, фильмы. Добавляй вручную или загружай скриншот — ИИ распознает что на нём.
              </p>
              <p className="card-text" style={{ marginTop: 10 }}>
                Когда накопится достаточно, жми вайбчек — получишь короткий портрет периода от не очень объективного, но довольно проницательного алгоритма.
              </p>
            </div>

            <div className="home-tiles">
              <button className="home-tile tile-pink" onClick={() => setTab("add")}>
                <div className="home-tile-label">музыка</div>
                <div className="home-tile-title">всё, что ты слушаешь</div>
                <div className="home-tile-copy">подключи spotify, импортируй из last.fm, загрузи по скриншоту или впиши вручную</div>
              </button>

              <button className="home-tile tile-green" onClick={() => setTab("add")}>
                <div className="home-tile-label">книги</div>
                <div className="home-tile-title">книжная полка</div>
                <div className="home-tile-copy">скинь фотку книги или книжной полки, загрузи статистику из livelib, goodreads или другого сервиса</div>
              </button>

              <button className="home-tile tile-blue" onClick={() => setTab("add")}>
                <div className="home-tile-label">фильмы</div>
                <div className="home-tile-title">все просмотры</div>
                <div className="home-tile-copy">импортируй контент из letterboxd, кинопоиска, mubi и других подключенных источников</div>
              </button>

              <button className="home-tile tile-yellow" onClick={() => setTab("vibe")}>
                <div className="home-tile-label">вайбчек</div>
                <div className="home-tile-title">узнай себя получше</div>
                <div className="home-tile-copy">когда будешь готов — нажми «вайбчек» и сам все поймешь</div>
              </button>
            </div>
          </>
        )}

        {/* ADD */}
        {tab === "add" && (
          <div className="card">
            <div className="card-title">добавить</div>

            <div className="mode-toggle">
              <button
                className={`mode-btn${!manualMode ? " active" : ""}`}
                onClick={() => setManualMode(false)}
              >
                импорт изображения
              </button>
              <button
                className={`mode-btn${manualMode ? " active" : ""}`}
                onClick={() => setManualMode(true)}
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
                    style={!(deepVibeAccess === "forever" || deepVibeAccess === "paid") ? {opacity:0.45} : {}}
                    onClick={() => {
                      if (deepVibeAccess === "forever" || deepVibeAccess === "paid") {
                        setManualType("custom");
                      } else {
                        buyDeepVibeForever();
                      }
                    }}
                    title={deepVibeAccess === "forever" || deepVibeAccess === "paid" ? "своя категория" : "доступно с подпиской"}
                  >
                    ✦ своё {!(deepVibeAccess === "forever" || deepVibeAccess === "paid") && "🔒"}
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
                        onClick={() => setSelectedImportService(service)}
                        disabled={importLoading || savingImported || spotifySyncing}
                        aria-label={`инструкция ${service.title}`}
                      >
                        ?
                      </button>
                      <button
                        type="button"
                        className="import-service-main"
                        onClick={() => startImportService(service)}
                        disabled={importLoading || savingImported || spotifySyncing}
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

                <input
                  ref={csvImportRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && selectedImportService && selectedImportService.id !== "spotify") {
                      importCsvPlatform(selectedImportService.id, f);
                    }
                    e.target.value = "";
                  }}
                />

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) runImport(files);
                  }}/>

                <button
                  className="btn btn-outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={importLoading}
                >
                  {importLoading ? "разбираю изображения..." : "загрузить изображения →"}
                </button>

                {importStatus && !importError && (
                  <div style={{marginTop:12,fontSize:13,color:"#6f6a63"}}>{importStatus}</div>
                )}
                {importError && <div className="error">{importError}</div>}

                {imported.length > 0 && (
                  <>
                    <hr className="divider" />
                    <div className="section-label">найдено {imported.length} айтемов</div>
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
                        onClick={saveSelectedImported}
                        disabled={savingImported}
                      >
                        {savingImported ? "сохраняю..." : `сохранить выбранное (${selectedIdx.size}) →`}
                      </button>
                    </div>

                  {imported.map((it, i) => (
                      <div
                        key={i}
                        className={`import-item${selectedIdx.has(i) ? " selected" : ""}`}
                        onClick={() => toggleImported(i)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIdx.has(i)}
                          onChange={() => toggleImported(i)}
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
                      onClick={saveSelectedImported}
                      disabled={savingImported}
                    >
                      {savingImported ? "сохраняю..." : `сохранить выбранное (${selectedIdx.size}) →`}
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
                    className={`filter-btn${libraryView === "tiles" ? " active" : ""}`}
                    onClick={() => setLibraryView("tiles")}
                  >
                    плитки
                  </button>
                  <button
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

              <div className="section-label">тип контента</div>
              <div className="filter-row">
                {([["all", "все"], ["music", "музыка"], ["book", "книги"], ["movie", "фильмы"]] as [string, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    className={`filter-btn${libFilter === val ? " active" : ""}`}
                    onClick={() => setLibFilter(val)}
                  >
                    {label}
                  </button>
                ))}
                {customCategories.map(cat => (
                  <button
                    key={cat.id}
                    className={`filter-btn${libFilter === cat.id ? " active" : ""}`}
                    onClick={() => setLibFilter(cat.id)}
                  >
                    {cat.emoji} {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {libraryError && <div className="error">{libraryError}</div>}

            {libraryLoading ? (
              <div className="empty">загружаю…</div>
            ) : filteredItems.length === 0 ? (
              <div className="empty">
                {items.length === 0 ? "пока пусто — добавь что-нибудь!" : "нет айтемов этого типа"}
              </div>
            ) : libraryView === "calendar" ? (
              <>
                <div className="calendar-shell">
                  <div className="calendar-top-row">
                    <button className="calendar-arrow" onClick={() => setCalendarMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1)))}>‹</button>
                    <div className="calendar-title">
                      {calendarMonth
                        .toLocaleString("ru-RU", { month: "long", year: "numeric" })
                        .replace(/\sг\.$/, "")
                        .replace(/^./, (char) => char.toUpperCase())}
                    </div>
                    <button className="calendar-arrow" onClick={() => setCalendarMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1)))}>›</button>
                  </div>

                  <div className="calendar-weekdays">
                    {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((label) => (
                      <div key={label} className="calendar-weekday">{label}</div>
                    ))}
                  </div>

                  <div className="calendar-grid">
                    {calendarDays.map((day) => (
                      <button
                        key={day.key}
                        className={`calendar-day${!day.inMonth ? " muted" : ""}${selectedDay?.key === day.key ? " selected" : ""}`}
                        onClick={() => {
                          setSelectedDayKey(day.key);
                          setDayModalOpen(true);
                        }}
                      >
                        <div className="calendar-day-head">
                          <span className="calendar-day-number">{day.date.getDate()}</span>
                          {day.items.length > 0 ? <span className="calendar-day-count">{day.items.length}</span> : null}
                        </div>
                        {day.items.slice(0, 2).map((item) => (
                          <div key={String(item.id)} className={`calendar-chip ${item.type}`}>
                            {item.title}
                          </div>
                        ))}
                        {day.items.length > 2 ? <div className="calendar-more">+ еще {day.items.length - 2}</div> : null}
                      </button>
                    ))}
                  </div>
                </div>

                {dayModalOpen && selectedDay ? (
                  <div className="day-modal-backdrop" onClick={() => setDayModalOpen(false)}>
                    <div className="day-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="day-modal-head">
                        <div className="card-title" style={{ marginBottom: 0 }}>
                          {selectedDay.date
                            .toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
                            .replace(/^./, (char) => char.toUpperCase())}
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={() => setDayModalOpen(false)}>закрыть</button>
                      </div>

                      <div className="day-week-strip">
                        {Array.from({ length: 7 }, (_, index) => {
                          const base = addDays(selectedDay.date, -((selectedDay.date.getDay() + 6) % 7));
                          const date = addDays(base, index);
                          const key = dayKey(date);
                          return (
                            <button
                              key={key}
                              className={`day-week-pill${key === selectedDay.key ? " active" : ""}`}
                              onClick={() => {
                                setSelectedDayKey(key);
                                setDayModalOpen(true);
                              }}
                            >
                              <div className="day-week-name">{date.toLocaleString("ru-RU", { weekday: "short" })}</div>
                              <div className="day-week-number">{date.getDate()}</div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="day-modal-scroll">
                        {(itemsByDay.get(selectedDay.key) ?? []).length > 0 ? (
                          (itemsByDay.get(selectedDay.key) ?? []).map((it) => (
                            <div key={String(it.id)} className={`item-card ${it.type}`}>
                              <div className="item-topline">
                                <div className="item-meta">
                                  <span className="tag">{it.type === "custom" && it.custom_category_name ? `${it.custom_category_emoji ?? "✦"} ${it.custom_category_name}` : TYPE_LABELS[it.type]}</span>
                                </div>
                                <div className="item-date">{formatShortDate(it.created_at)}</div>
                              </div>
                              <div className="item-body">
                                {it.creator && <div className="item-title">{it.creator}</div>}
                                <div className="item-creator">{it.title}</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="empty">в этот день пока пусто</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="items-grid">
                {filteredItems.map((it) => (
                  <div key={String(it.id)} className={`item-card ${it.type}`}>
                    <div className="item-topline">
                      <div className="item-meta">
                        <span className="tag">{it.type === "custom" && it.custom_category_name ? `${it.custom_category_emoji ?? "✦"} ${it.custom_category_name}` : TYPE_LABELS[it.type]}</span>
                      </div>
                      <div className="item-date">{formatShortDate(it.created_at)}</div>
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
                сейчас в библиотеке {counts.total}: музыка {counts.music}, книги {counts.books}, фильмы {counts.movies}.
              </div>
              <div className="vibe-meta">
                быстрый вайбчек — это короткий культурный срез без глубокого анализа состояния.
              </div>
              <button
                className="btn btn-outline"
                style={{ background: "#ffffff", borderColor: "#ffffff" }}
                onClick={runVibeCheck}
                disabled={vibeLoading || counts.total === 0}
              >
                {vibeLoading ? "анализирую..." : counts.total === 0 ? "сначала добавь контент" : "провести вайбчек"}
              </button>
            </div>

            {vibeError && <div className="error">{vibeError}</div>}
            {summary && (
              <div className="vibe-section vibe-pink">
                <div className="card-title" style={{ marginBottom: 10 }}>свежий срез</div>
                <VibeResult summary={summary} />
                <button
                  className="btn btn-outline"
                  style={{marginTop:12,fontSize:13,display:"flex",alignItems:"center",gap:6,width:"100%"}}
                  onClick={() => shareVibeCard(summary, "vibe")}
                >
                  ↗ поделиться вайбчеком
                </button>
              </div>
            )}

            <button
              className="btn btn-outline"
              style={{marginTop: 12}}
              onClick={runMentalAge}
              disabled={mentalAgeLoading || counts.total === 0}
            >
              {mentalAgeLoading ? "считаю..." : "рассчитать ментальный возраст"}
            </button>

            {mentalAge && (
              <div style={{marginTop:16,padding:"16px",background:"#fff",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                {mentalAge.split("\n").map((line, i) => (
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

            {/* Вайбчек без прикола — платный */}
            <div className="vibe-section vibe-green">
              <div className="card-title" style={{ marginBottom: 10 }}>вайбчек без прикола</div>
              <div className="vibe-helper">
                серьезный срез периода: что у тебя сейчас по темам, эмоциональному фону и куда все это движется.
              </div>

              {/* Кнопка запуска — если есть доступ */}
              {(deepVibeAccess === "free" || deepVibeAccess === "forever" || deepVibeAccess === "paid") && (
                <div>
                  {deepVibeAccess === "free" && deepVibeUsesLeft !== null && (
                    <div style={{textAlign:"center",fontSize:12,color:"#aaa",marginBottom:10}}>
                      осталось бесплатных: {deepVibeUsesLeft} из 3
                    </div>
                  )}
                  {deepVibeAccess === "forever" && (
                    <div style={{textAlign:"center",fontSize:12,color:"#aaa",marginBottom:10}}>
                      вечный доступ
                    </div>
                  )}
                  <button
                    className="btn"
                    style={{background:"#1a1a1a",color:"#fff",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
                    onClick={runDeepVibe}
                    disabled={deepVibeLoading || counts.total === 0}
                  >
                    {deepVibeLoading ? "анализирую..." : "вайбчек без прикола"}
                  </button>
                </div>
              )}

              {/* Нет доступа — показываем кнопки покупки */}
              {deepVibeAccess === "none" && (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <button
                    className="btn"
                    style={{background:"#1a1a1a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
                    onClick={buyDeepVibeOnce}
                    disabled={counts.total === 0}
                  >
                    ✦ один анализ — 5 ★
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,borderColor:"#1a1a1a"}}
                    onClick={buyDeepVibeForever}
                    disabled={counts.total === 0}
                  >
                    ✦ вечный доступ — 200 ★
                  </button>
                  <div style={{fontSize:11,color:"#aaa",textAlign:"center"}}>оплата через Telegram Stars</div>
                </div>
              )}

              {/* Результат с markdown */}
              {deepVibeResult && (
                <div style={{marginTop:16,padding:"18px",background:"#fff",borderRadius:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",fontSize:14,lineHeight:1.8,color:"#333"}}>
                  <MarkdownText text={deepVibeResult} />
                  <button
                    className="btn btn-outline"
                    style={{marginTop:14,fontSize:13,display:"flex",alignItems:"center",gap:6,width:"100%"}}
                    onClick={() => shareVibeCard(deepVibeResult, "deep")}
                  >
                    ↗ поделиться
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {selectedImportService && (
          <div className="service-modal-backdrop" onClick={() => setSelectedImportService(null)}>
            <div className="service-modal" onClick={(e) => e.stopPropagation()}>
              <div className="service-modal-top">
                <div className="service-modal-title">{selectedImportService.title}</div>
                <button className="btn btn-outline btn-sm" onClick={() => setSelectedImportService(null)}>
                  закрыть
                </button>
              </div>

              {selectedImportService.instructions && (
                <div className="service-modal-copy">
                  <ul>
                    {selectedImportService.instructions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedImportService.id === "lastfm" && (
                <div className="input-group" style={{ marginTop: 12 }}>
                  <div className="input-label">username last.fm</div>
                  <input
                    className="input"
                    placeholder="например: nastyad"
                    value={lastfmProfileInput}
                    onChange={(e) => setLastfmProfileInput(e.target.value)}
                  />
                  <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                    импортируем recent tracks из публичного профиля last.fm
                  </div>
                  {importLoading ? (
                    <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                      {importStatus || "смотрим профиль..."}
                    </div>
                  ) : null}
                </div>
              )}

              {selectedImportService.id === "letterboxd" && (
                <div className="input-group" style={{ marginTop: 12 }}>
                  <div className="input-label">username или ссылка на profile</div>
                  <input
                    className="input"
                    placeholder="например: letterboxd.com/nastyad/"
                    value={letterboxdProfileInput}
                    onChange={(e) => setLetterboxdProfileInput(e.target.value)}
                  />
                  <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                    public profile beta: лучше всего работает с открытым профилем
                  </div>
                  {importLoading ? (
                    <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                      {importStatus || "смотрим профиль..."}
                    </div>
                  ) : null}
                </div>
              )}

              {selectedImportService.id === "lastfm" ? (
                <>
                  <button
                    className="btn"
                    style={{ marginTop: 16 }}
                    onClick={importLastfmProfileWeb}
                    disabled={importLoading}
                  >
                    импортировать профиль
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ marginTop: 12 }}
                    onClick={confirmCsvImport}
                    disabled={importLoading}
                  >
                    или выбрать csv
                  </button>
                </>
              ) : selectedImportService.id === "letterboxd" ? (
                <>
                  <button
                    className="btn"
                    style={{ marginTop: 16 }}
                    onClick={importLetterboxdProfileWeb}
                    disabled={importLoading}
                  >
                    импортировать профиль
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ marginTop: 12 }}
                    onClick={confirmCsvImport}
                    disabled={importLoading}
                  >
                    или выбрать csv
                  </button>
                </>
              ) : (
                <button
                  className="btn"
                  style={{ marginTop: 16 }}
                  onClick={confirmCsvImport}
                  disabled={importLoading}
                >
                  {selectedImportService.actionLabel ?? "выбрать файл"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="nav">
        {([
          ["home", "◎", "главная"],
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
        </button>
        <button
          className={`nav-btn${tab === "vibe" ? " active" : ""}`}
          onClick={() => setTab("vibe")}

        >
          <span className="nav-icon" style={{display:"flex",alignItems:"center"}}><img src="data:image/png;base64,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" width="24" height="24" style={{imageRendering:"auto"}}/></span>
          вайбчек
        </button>
        {tgUserId === ADMIN_TG_ID && (
          <button
            className={`nav-btn${tab === "admin" ? " active" : ""}`}
            onClick={() => setTab("admin")}
          >
            <span className="nav-icon">📊</span>
            стата
          </button>
        )}
      </nav>
      {tab === "admin" && tgUserId === ADMIN_TG_ID && <AdminTab />}

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
                const typeItems = items.filter(i => i.type === t || (t === "movie" && (i.type as string) === "film"));
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
                  const dataUrl = await generateShareCard(sharePickerText, sharePickerType, selectedItems.length > 0 ? selectedItems : undefined);
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

function AdminTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [topUsers, setTopUsers] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const initData = (window as any).Telegram?.WebApp?.initData || "";
      const headers = { "x-telegram-init-data": initData };
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

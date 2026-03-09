"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Tab = "home" | "add" | "library" | "vibe" | "admin";

const ADMIN_TG_ID = 394657396; // espritdlparesse
type ItemType = "music" | "book" | "movie";
type ItemSource = "spotify" | "goodreads" | "letterboxd" | "manual";

type ImportedItem = {
  type: ItemType;
  source: ItemSource;
  title: string;
  creator?: string | null;
};

type DbItem = {
  id: string | number;
  tg_user_id?: number;
  type: ItemType;
  source: ItemSource;
  title: string;
  creator?: string | null;
  created_at?: string;
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

async function safeJson(res: Response) {
  try { return await res.json(); } catch { return {}; }
}

const TYPE_LABELS: Record<ItemType, string> = {
  music: "музыка",
  book: "книга",
  movie: "фильм",
};

const TYPE_ICONS: Record<ItemType, string> = {
  music: "♪",
  book: "◻",
  movie: "◈",
};

const TYPE_COLORS: Record<ItemType, string> = {
  music: "#c8f0d8",
  book: "#fde8c8",
  movie: "#d8e8fd",
};

export default function Page() {
  const [tab, setTab] = useState<Tab>("home");
  const [helloName, setHelloName] = useState("привет!");
  const [tgUserId, setTgUserId] = useState<number | null>(null);

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

  // ===== Library =====
  const [items, setItems] = useState<DbItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);
  const [spotifySyncing, setSpotifySyncing] = useState(false);

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

  useEffect(() => { loadLibrary(); }, []);

  const counts = useMemo(() => ({
    total: items.length,
    music: items.filter((i) => i.type === "music").length,
    books: items.filter((i) => i.type === "book").length,
    movies: items.filter((i) => i.type === "movie").length,
  }), [items]);

  // ===== Import =====
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [imported, setImported] = useState<ImportedItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [savingImported, setSavingImported] = useState(false);

  function toggleImported(i: number) {
    const next = new Set(selectedIdx);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelectedIdx(next);
  }

  async function runImport(file: File) {
    setImportError(""); setImportLoading(true); setImported([]); setSelectedIdx(new Set());
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import-image", {
        method: "POST",
        headers: { "x-telegram-init-data": getTgInitData() },
        body: form,
      });
      const json = await safeJson(res);
      if (!res.ok) { setImportError(json?.error ?? "Импорт не удался"); return; }
      const list: ImportedItem[] = json?.items ?? [];
      setImported(list);
      setSelectedIdx(new Set(list.map((_, i) => i)));
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
      body: JSON.stringify({ items: itemsToSave.map((it) => ({ type: it.type, source: it.source, title: it.title, creator: it.creator ?? null })) }),
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

  // Проверяем доступ при переходе на вкладку вайбчека
  const prevTabRef = useRef<string>("");
  useEffect(() => {
    if (tab === "vibe" && prevTabRef.current !== "vibe") {
      fetchDeepVibeAccess();
    }
    if (tab === "library" && prevTabRef.current !== "library") {
      checkSpotify();
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
  const [libFilter, setLibFilter] = useState<ItemType | "all">("all");
  const filteredItems = useMemo(() =>
    libFilter === "all" ? items : items.filter((i) => i.type === libFilter),
    [items, libFilter]
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=Onest:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #f5f2ec;
          color: #1a1a1a;
          font-family: 'Onest', sans-serif;
          min-height: 100vh;
        }

        .app {
          max-width: 480px;
          margin: 0 auto;
          padding: 24px 16px 100px;
        }

        .header {
          margin-bottom: 28px;
        }

        .brand {
          font-family: 'Unbounded', sans-serif;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -1px;
          color: #1a1a1a;
          line-height: 1;
        }

        .greeting {
          font-size: 13px;
          font-weight: 300;
          color: #888;
          margin-top: 4px;
          letter-spacing: 0.3px;
        }

        /* Bottom nav */
        .nav {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          display: flex;
          background: #1a1a1a;
          z-index: 100;
          max-width: 480px;
          margin: 0 auto;
        }

        .nav-btn {
          flex: 1;
          padding: 14px 4px 16px;
          border: none;
          background: transparent;
          color: #888;
          font-family: 'Onest', sans-serif;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          transition: color 0.15s;
          letter-spacing: 0.3px;
        }

        .nav-btn.active { color: #f5f2ec; }

        .nav-icon {
          font-size: 18px;
          line-height: 1;
        }

        /* Cards */
        .card {
          background: white;
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }

        .card-title {
          font-family: 'Unbounded', sans-serif;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.5px;
          margin-bottom: 12px;
        }

        .card-text {
          font-size: 14px;
          font-weight: 300;
          color: #555;
          line-height: 1.6;
        }

        /* Buttons */
        .btn {
          width: 100%;
          padding: 14px;
          border-radius: 14px;
          border: none;
          background: #1a1a1a;
          color: #f5f2ec;
          font-family: 'Onest', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          letter-spacing: 0.2px;
        }
        .btn:disabled { opacity: 0.5; cursor: default; }
        .btn:active:not(:disabled) { transform: scale(0.98); }

        .btn-outline {
          background: transparent;
          border: 1.5px solid #ddd;
          color: #1a1a1a;
        }

        .btn-sm {
          width: auto;
          padding: 8px 14px;
          font-size: 13px;
          border-radius: 10px;
        }

        /* Stats row */
        .stats {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        .stat-pill {
          flex: 1;
          background: #f5f2ec;
          border-radius: 12px;
          padding: 12px 8px;
          text-align: center;
        }

        .stat-num {
          font-family: 'Unbounded', sans-serif;
          font-size: 22px;
          font-weight: 700;
          line-height: 1;
        }

        .stat-label {
          font-size: 11px;
          color: #888;
          margin-top: 3px;
          font-weight: 300;
        }

        /* Home quick actions */
        .actions { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }

        /* Type selector */
        .type-row {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .type-btn {
          flex: 1;
          padding: 10px 6px;
          border-radius: 12px;
          border: 2px solid transparent;
          background: #f5f2ec;
          font-family: 'Onest', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
        }

        .type-btn.active {
          border-color: #1a1a1a;
          background: white;
        }

        /* Input */
        .input-group { margin-bottom: 12px; }
        .input-label {
          font-size: 12px;
          font-weight: 500;
          color: #888;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .input {
          width: 100%;
          padding: 13px 14px;
          border: 1.5px solid #e8e8e8;
          border-radius: 12px;
          font-family: 'Onest', sans-serif;
          font-size: 15px;
          font-weight: 400;
          color: #1a1a1a;
          background: white;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus { border-color: #1a1a1a; }
        .input::placeholder { color: #bbb; }

        /* Item card */
        .item-card {
          background: white;
          border-radius: 16px;
          padding: 14px 16px;
          margin-bottom: 10px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          box-shadow: 0 1px 6px rgba(0,0,0,0.05);
        }

        .item-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .item-body { flex: 1; min-width: 0; }

        .item-title {
          font-family: 'Unbounded', sans-serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .item-creator {
          font-size: 12px;
          color: #888;
          margin-top: 2px;
          font-weight: 300;
        }

        .item-meta {
          display: flex;
          gap: 6px;
          margin-top: 8px;
          flex-wrap: wrap;
        }

        .tag {
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          background: #f0f0f0;
          color: #666;
        }

        .delete-btn {
          background: none;
          border: none;
          color: #ccc;
          cursor: pointer;
          font-size: 18px;
          padding: 4px;
          flex-shrink: 0;
          transition: color 0.15s;
          line-height: 1;
        }
        .delete-btn:hover { color: #e74c3c; }

        /* Import item */
        .import-item {
          border: 1.5px solid #eee;
          border-radius: 14px;
          padding: 14px;
          margin-bottom: 10px;
          display: flex;
          gap: 10px;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .import-item.selected { border-color: #1a1a1a; }

        /* Filter tabs */
        .filter-row {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .filter-btn {
          flex-shrink: 0;
          padding: 7px 14px;
          border-radius: 999px;
          border: 1.5px solid #e0e0e0;
          background: white;
          font-family: 'Onest', sans-serif;
          font-size: 13px;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .filter-btn.active {
          background: #1a1a1a;
          border-color: #1a1a1a;
          color: white;
        }

        /* Error & success */
        .error { color: #e74c3c; font-size: 13px; margin-top: 10px; }
        .success { color: #27ae60; font-size: 13px; margin-top: 10px; font-weight: 500; }

        /* Vibe output */
        .vibe-text {
          margin-top: 16px;
          padding: 20px;
          background: #f5f2ec;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 300;
          line-height: 1.8;
          white-space: pre-wrap;
          color: #333;
        }

        /* Divider */
        .divider {
          border: none;
          border-top: 1.5px solid #f0f0f0;
          margin: 20px 0;
        }

        .section-label {
          font-size: 11px;
          font-weight: 500;
          color: #aaa;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 12px;
        }

        .empty {
          text-align: center;
          padding: 40px 20px;
          color: #aaa;
          font-size: 14px;
          font-weight: 300;
        }

        .mode-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }

        .mode-btn {
          flex: 1;
          padding: 11px;
          border-radius: 12px;
          border: 1.5px solid #e0e0e0;
          background: white;
          font-family: 'Onest', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
        }
        .mode-btn.active {
          background: #1a1a1a;
          border-color: #1a1a1a;
          color: white;
        }
      `}</style>

      <div className="app">
        <div className="header">
          <div className="brand">everyyou</div>
          <div className="greeting">{helloName}</div>
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
              <div className="card-title">что это</div>
              <p className="card-text">
                EveryYou — место куда можно скидывать весь контент который ты потребляешь: музыку, книги, фильмы. Добавляй вручную или загружай скриншот — ИИ распознает что на нём.
              </p>
              <p className="card-text" style={{ marginTop: 10 }}>
                Когда накопится достаточно, жми вайбчек — получишь короткий портрет периода от не очень объективного, но довольно проницательного алгоритма.
              </p>
              <p className="card-text" style={{ marginTop: 10, opacity: 0.5, fontSize: 12 }}>
                work in progress. многое ещё не доделано — но уже работает.
              </p>
              <div className="actions">
                <button className="btn" onClick={() => setTab("add")}>добавить контент →</button>
                <button className="btn btn-outline" onClick={() => setTab("library")}>библиотека →</button>
                <button className="btn btn-outline" onClick={() => setTab("vibe")}>вайбчек →</button>
              </div>
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
                📷 импорт скрина
              </button>
              <button
                className={`mode-btn${manualMode ? " active" : ""}`}
                onClick={() => setManualMode(true)}
              >
                ✏️ вручную
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
                </div>

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
                    {manualType === "music" ? "исполнитель" : manualType === "book" ? "автор" : "режиссёр"}
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
                  Загрузи скриншот — из Spotify, заметок, списков, да откуда угодно. ИИ постарается разобрать что там.
                </p>
                <p className="card-text" style={{ marginBottom: 16, opacity: 0.5, fontSize: 12 }}>
                  нормальной интеграции с площадками пока нет — авторам было лень. докрутим потом.
                </p>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) runImport(f); }}
                />

                <button
                  className="btn btn-outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={importLoading}
                >
                  {importLoading ? "распознаю..." : "выбрать скриншот →"}
                </button>

                {importError && <div className="error">{importError}</div>}

                {imported.length > 0 && (
                  <>
                    <hr className="divider" />
                    <div className="section-label">найдено {imported.length} айтемов</div>

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
                            <span className="tag">{TYPE_LABELS[it.type]}</span>
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

            {/* Spotify */}
            <div style={{marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
              {spotifyConnected === false && (
                <button
                  className="btn btn-outline"
                  style={{fontSize:13,display:"flex",alignItems:"center",gap:6,flex:1}}
                  onClick={connectSpotify}
                >
                  <span style={{color:"#1db954"}}>♫</span> подключить Spotify
                </button>
              )}
              {spotifyConnected === true && (
                <button
                  className="btn btn-outline"
                  style={{fontSize:13,display:"flex",alignItems:"center",gap:6,flex:1}}
                  onClick={syncSpotify}
                  disabled={spotifySyncing}
                >
                  <span style={{color:"#1db954"}}>♫</span> {spotifySyncing ? "синхронизирую..." : "обновить из Spotify"}
                </button>
              )}
            </div>

            <div className="filter-row">
              {([["all", "все"], ["music", "музыка"], ["book", "книги"], ["movie", "фильмы"]] as [ItemType | "all", string][]).map(([val, label]) => (
                <button
                  key={val}
                  className={`filter-btn${libFilter === val ? " active" : ""}`}
                  onClick={() => setLibFilter(val)}
                >
                  {label}
                </button>
              ))}
            </div>

            {libraryError && <div className="error">{libraryError}</div>}

            {libraryLoading ? (
              <div className="empty">загружаю…</div>
            ) : filteredItems.length === 0 ? (
              <div className="empty">
                {items.length === 0 ? "пока пусто — добавь что-нибудь!" : "нет айтемов этого типа"}
              </div>
            ) : (
              filteredItems.map((it) => (
                <div key={String(it.id)} className="item-card">
                  <div
                    className="item-icon"
                    style={{ background: TYPE_COLORS[it.type] }}
                  >
                    {TYPE_ICONS[it.type]}
                  </div>
                  <div className="item-body">
                    <div className="item-title">{it.title}</div>
                    {it.creator && <div className="item-creator">{it.creator}</div>}
                    <div className="item-meta">
                      <span className="tag">{TYPE_LABELS[it.type]}</span>
                    </div>
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
              ))
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
            <p className="card-text">
              Смотрит на всё что ты сохранил и говорит что думает.
            </p>
            <p className="card-text" style={{ marginTop: 8, opacity: 0.5, fontSize: 12 }}>
              work in progress. чем больше контента — тем точнее.
            </p>

            <div className="stats" style={{ marginTop: 16 }}>
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

            <button
              className="btn"
              style={{ marginTop: 4 }}
              onClick={runVibeCheck}
              disabled={vibeLoading || counts.total === 0}
            >
              {vibeLoading ? "анализирую..." : counts.total === 0 ? "сначала добавь контент" : "провести вайбчек →"}
            </button>

            {vibeError && <div className="error">{vibeError}</div>}
            {summary && <VibeResult summary={summary} />}

            <button
              className="btn btn-outline"
              style={{marginTop: 12}}
              onClick={runMentalAge}
              disabled={mentalAgeLoading || counts.total === 0}
            >
              {mentalAgeLoading ? "считаю..." : "🧠 рассчитать ментальный возраст"}
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
            <div style={{marginTop:24,borderTop:"1px solid #e8e3da",paddingTop:20}}>
              <div style={{fontSize:13,fontWeight:600,color:"#1a1a1a",marginBottom:8,textAlign:"center"}}>
                вайбчек без прикола
              </div>
              <div style={{fontSize:12,color:"#888",marginBottom:14,lineHeight:1.6,textAlign:"center"}}>
                серьёзный анализ всего что ты добавил. алгоритм составит что-то вроде психологического портрета — какие темы тебя цепляют, какое настроение прослеживается, и посоветует что ещё почитать, посмотреть или послушать, исходя из твоего состояния.
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
                      ✦ вечный доступ
                    </div>
                  )}
                  <button
                    className="btn"
                    style={{background:"#1a1a1a",color:"#fff",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
                    onClick={runDeepVibe}
                    disabled={deepVibeLoading || counts.total === 0}
                  >
                    ✦ {deepVibeLoading ? "анализирую..." : "вайбчек без прикола →"}
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
                <div style={{marginTop:16,padding:"18px",background:"#fff",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",fontSize:14,lineHeight:1.8,color:"#333"}}>
                  <MarkdownText text={deepVibeResult} />
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="nav">
        {([
          ["home", "◎", "главная"],
          ["add", "+", "добавить"],
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
  const idx = summary.indexOf("\n→");
  const roast = idx !== -1 ? summary.slice(0, idx).trim() : summary.trim();
  const recs = idx !== -1 ? summary.slice(idx + 2).trim() : "";
  return (
    <div>
      <div className="vibe-text">{roast}</div>
      {recs && (
        <div style={{marginTop:16,padding:"14px 16px",background:"#f0ede6",borderRadius:12,fontSize:14,lineHeight:1.6,color:"#555"}}>
          <span style={{fontWeight:600,color:"#1a1a1a"}}>→ </span>{recs}
        </div>
      )}
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

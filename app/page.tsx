"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Tab = "home" | "add" | "library" | "vibe";
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
  }, []);

  // ===== Library =====
  const [items, setItems] = useState<DbItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");

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
            {summary && <div className="vibe-text">{summary}</div>}
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
          <span className="nav-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              {/* тело */}
              <ellipse cx="16" cy="20" rx="9" ry="7" />
              {/* голова */}
              <ellipse cx="16" cy="12" rx="6" ry="5" />
              {/* левый глаз-бугор */}
              <circle cx="11" cy="9" r="2.5" />
              {/* правый глаз-бугор */}
              <circle cx="21" cy="9" r="2.5" />
              {/* левая лапа */}
              <path d="M7 23 Q3 26 2 29 Q5 28 7 27 Q8 29 10 30 Q10 27 9 25Z" />
              {/* правая лапа */}
              <path d="M25 23 Q29 26 30 29 Q27 28 25 27 Q24 29 22 30 Q22 27 23 25Z" />
            </svg>
          </span>
          вайбчек
        </button>
      </nav>
    </>
  );
}

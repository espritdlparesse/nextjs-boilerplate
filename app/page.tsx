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

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("home");

  // ===== Telegram init =====
  const [helloName, setHelloName] = useState("привет!");

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    try {
      tg?.ready?.();
      tg?.expand?.();
    } catch {}

    const first = tg?.initDataUnsafe?.user?.first_name;
    const last = tg?.initDataUnsafe?.user?.last_name;
    const username = tg?.initDataUnsafe?.user?.username;

    const name =
      first || last
        ? [first, last].filter(Boolean).join(" ")
        : username
        ? `@${username}`
        : "";

    setHelloName(name ? `привет, ${name}!` : "привет!");
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
        headers: {
          "x-telegram-init-data": getTgInitData(),
        },
      });

      const json = await safeJson(res);

      if (!res.ok) {
        setLibraryError(json?.error ?? "Ошибка загрузки");
        setItems([]);
        return;
      }

      setItems(Array.isArray(json?.items) ? json.items : []);
    } catch (e: any) {
      setLibraryError(e?.message ?? "Network error");
    } finally {
      setLibraryLoading(false);
    }
  }

  useEffect(() => {
    loadLibrary();
  }, []);

  const counts = useMemo(() => {
    return {
      total: items.length,
      music: items.filter((i) => i.type === "music").length,
      books: items.filter((i) => i.type === "book").length,
      movies: items.filter((i) => i.type === "movie").length,
    };
  }, [items]);

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
    setImportError("");
    setImportLoading(true);
    setImported([]);
    setSelectedIdx(new Set());

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/import-image", {
        method: "POST",
        headers: {
          "x-telegram-init-data": getTgInitData(),
        },
        body: form,
      });

      const json = await safeJson(res);

      if (!res.ok) {
        setImportError(json?.error ?? "Импорт не удался");
        return;
      }

      const list: ImportedItem[] = json?.items ?? [];
      setImported(list);
      setSelectedIdx(new Set(list.map((_, i) => i)));
    } catch (e: any) {
      setImportError(e?.message ?? "Network error");
    } finally {
      setImportLoading(false);
    }
  }

  // ===== BULK SAVE (iOS-safe) =====
  async function saveSelected(items: ImportedItem[]) {
    const payload = {
      items: items.map((item) => ({
        type: item.type,
        source: item.source,
        title: item.title,
        creator: item.creator ?? null,
      })),
    };

    const initData = getTgInitData();
    const url = `${window.location.origin}/api/items/bulk`;

    let res: Response;

    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": initData,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
    } catch (e: any) {
      throw new Error(
        e?.message ? `fetch failed: ${e.message}` : "fetch failed"
      );
    }

    const json = await safeJson(res);

    if (!res.ok) {
      throw new Error(json?.error ?? `HTTP ${res.status}`);
    }
  }

  async function saveSelectedImported() {
    setSavingImported(true);
    setImportError("");

    try {
      const selected = imported.filter((_, i) => selectedIdx.has(i));
      if (selected.length === 0) {
        setImportError("Ничего не выбрано");
        return;
      }

      await saveSelected(selected);

      setImported([]);
      setSelectedIdx(new Set());
      await loadLibrary();
      setTab("library");
    } catch (e: any) {
      setImportError(e?.message ?? "Ошибка сохранения");
    } finally {
      setSavingImported(false);
    }
  }

  // ===== Vibe Check =====
  const [summary, setSummary] = useState("");
  const [vibeLoading, setVibeLoading] = useState(false);
  const [vibeError, setVibeError] = useState("");

  async function runVibeCheck() {
    setVibeLoading(true);
    setVibeError("");
    setSummary("");

    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: {
          "x-telegram-init-data": getTgInitData(),
        },
      });

      const json = await safeJson(res);

      if (!res.ok) {
        setVibeError(json?.error ?? "Ошибка");
        return;
      }

      setSummary(json?.summary ?? "");
    } catch (e: any) {
      setVibeError(e?.message ?? "Network error");
    } finally {
      setVibeLoading(false);
    }
  }

  // ===== UI =====

  const styles = {
    page: { maxWidth: 720, margin: "0 auto", padding: 20, fontFamily: "system-ui" },
    brand: { fontSize: 42, fontWeight: 800, marginBottom: 10 },
    tabs: { display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" },
    tab: {
      padding: "8px 14px",
      borderRadius: 999,
      border: "1px solid #ddd",
      background: "white",
      cursor: "pointer",
    },
    tabActive: { background: "#111", color: "white" },
    card: { border: "1px solid #eee", borderRadius: 16, padding: 16 },
    btn: {
      width: "100%",
      padding: 14,
      borderRadius: 14,
      border: "1px solid #111",
      background: "#111",
      color: "white",
      cursor: "pointer",
      fontWeight: 700,
    },
    btnSecondary: {
      width: "100%",
      padding: 14,
      borderRadius: 14,
      border: "1px solid #ddd",
      background: "white",
      cursor: "pointer",
      fontWeight: 700,
    },
    error: { color: "crimson", marginTop: 10 },
  };

  return (
    <main style={styles.page}>
      <div style={styles.brand}>everyyou</div>
      <div>{helloName}</div>

      <div style={styles.tabs}>
        {["home", "add", "library", "vibe"].map((t) => (
          <button
            key={t}
            style={{
              ...styles.tab,
              ...(tab === t ? styles.tabActive : {}),
            }}
            onClick={() => setTab(t as Tab)}
          >
            {t === "add" ? "add content" : t === "vibe" ? "vibe check" : t}
          </button>
        ))}
      </div>

      {tab === "home" && (
        <div style={styles.card}>
          <p>музыка, книги и фильмы — в одном месте.</p>
        </div>
      )}

      {tab === "add" && (
        <div style={styles.card}>
          <p>импорт — чтобы быстро накидать контента</p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) runImport(f);
            }}
          />

          <button
            style={styles.btnSecondary}
            onClick={() => fileRef.current?.click()}
          >
            {importLoading ? "импортирую..." : "→ импорт"}
          </button>

          {importError && <div style={styles.error}>{importError}</div>}

          {imported.map((it, i) => (
            <div key={i} style={{ marginTop: 10 }}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedIdx.has(i)}
                  onChange={() => toggleImported(i)}
                />{" "}
                {it.title} — {it.creator}
              </label>
            </div>
          ))}

          {imported.length > 0 && (
            <button
              style={{ ...styles.btn, marginTop: 16 }}
              onClick={saveSelectedImported}
              disabled={savingImported}
            >
              {savingImported
                ? "сохраняю..."
                : "сохранить выбранное в библиотеку"}
            </button>
          )}
        </div>
      )}

      {tab === "library" && (
        <div style={styles.card}>
          <div>
            всего: {counts.total} · музыка: {counts.music} · книги:{" "}
            {counts.books} · фильмы: {counts.movies}
          </div>

          {items.map((it) => (
            <div key={it.id} style={{ marginTop: 10 }}>
              {it.title} — {it.creator}
            </div>
          ))}
        </div>
      )}

      {tab === "vibe" && (
        <div style={styles.card}>
          <button style={styles.btn} onClick={runVibeCheck}>
            {vibeLoading ? "думаю..." : "провести вайбчек"}
          </button>
          {vibeError && <div style={styles.error}>{vibeError}</div>}
          {summary && <div style={{ marginTop: 16 }}>{summary}</div>}
        </div>
      )}
    </main>
  );
}

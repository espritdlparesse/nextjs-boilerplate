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
  async function saveSelected(itemsToSave: ImportedItem[]) {
    const payload = {
      items: itemsToSave.map((item) => ({
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
      throw new Error(e?.message ? `fetch failed: ${e.message}` : "fetch failed");
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

  const styles: Record<string, React.CSSProperties> = {
    page: { maxWidth: 720, margin: "0 auto", padding: 20, fontFamily: "system-ui" },
    brand: { fontSize: 42, fontWeight: 800, marginBottom: 10 },
    tabs: {
      display: "flex",
      gap: 10,
      marginBottom: 20,
      flexWrap: "wrap" as const, // ✅ фикс TS
    },
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
          <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>что это</h2>
          <p style={{ marginTop: 12 }}>
            EveryYou помогает собрать весь потребляемый контент в одном месте. Музыка, книги и фильмы фиксируются в вашей библиотеке.
          </p>
          <p style={{ marginTop: 12 }}>
            Когда данных накопится достаточно, можно провести вайбчек и увидеть общую динамику.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            <button style={styles.btn} onClick={() => setTab("add")}>→ добавить контент</button>
            <button style={styles.btnSecondary} onClick={() => setTab("library")}>→ открыть библиотеку</button>
            <button style={styles.btnSecondary} onClick={() => setTab("vibe")}>→ вайбчек</button>
          </div>
        </div>
      )}

      {tab === "add" && (
        <div style={styles.card}>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>add content</h2>
          <p style={{ marginTop: 10 }}>
            импорт — чтобы быстро накидать музыки. сами добавили — чтобы внести вообще что угодно.
          </p>

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
            style={{ ...styles.btnSecondary, marginTop: 12 }}
            onClick={() => fileRef.current?.click()}
          >
            {importLoading ? "импортирую..." : "→ импорт"}
          </button>

          {importError && <div style={styles.error}>{importError}</div>}

          {imported.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {imported.map((it, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 10,
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIdx.has(i)}
                    onChange={() => toggleImported(i)}
                    style={{ marginTop: 4 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{it.title}</div>
                    <div style={{ opacity: 0.8, marginTop: 2 }}>{it.creator || "—"}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" as const }}>
                      <span style={{ padding: "6px 10px", borderRadius: 999, background: "#f3f3f3", fontSize: 12 }}>
                        {it.type === "music" ? "музыка" : it.type === "book" ? "книги" : "фильмы"}
                      </span>
                      <span style={{ padding: "6px 10px", borderRadius: 999, background: "#f3f3f3", fontSize: 12 }}>
                        {it.source}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              <button
                style={{ ...styles.btn, marginTop: 12 }}
                onClick={saveSelectedImported}
                disabled={savingImported}
              >
                {savingImported ? "сохраняю..." : "→ сохранить выбранное в библиотеку"}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "library" && (
        <div style={styles.card}>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>library</h2>
          <p style={{ marginTop: 10 }}>
            здесь будет ваша библиотека: музыка, книги и фильмы — всё в одном месте.
          </p>

          <div style={{ marginTop: 12, opacity: 0.85 }}>
            всего айтемов: {counts.total} · музыка: {counts.music} · книги: {counts.books} · фильмы: {counts.movies}
          </div>

          <button style={{ ...styles.btnSecondary, marginTop: 14 }} onClick={() => setTab("add")}>
            → добавить контент
          </button>

          {libraryError && <div style={styles.error}>{libraryError}</div>}

          {libraryLoading ? (
            <div style={{ marginTop: 14 }}>загружаю…</div>
          ) : (
            <div style={{ marginTop: 14 }}>
              {items.map((it) => (
                <div
                  key={String(it.id)}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{it.title}</div>
                  <div style={{ opacity: 0.8, marginTop: 2 }}>{it.creator || "—"}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" as const }}>
                    <span style={{ padding: "6px 10px", borderRadius: 999, background: "#f3f3f3", fontSize: 12 }}>
                      {it.type === "music" ? "музыка" : it.type === "book" ? "книги" : "фильмы"}
                    </span>
                    <span style={{ padding: "6px 10px", borderRadius: 999, background: "#f3f3f3", fontSize: 12 }}>
                      {it.source}
                    </span>
                  </div>
                </div>
              ))}
              {items.length === 0 && <div style={{ marginTop: 10 }}>пока пусто</div>}
            </div>
          )}
        </div>
      )}

      {tab === "vibe" && (
        <div style={styles.card}>
          <h2 style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>вайбчек</h2>
          <p style={{ marginTop: 10 }}>
            Здесь можно провести вайбчек всей вашей библиотеки. Алгоритм анализирует сохранённый контент и собирает общий портрет периода.
          </p>
          <p style={{ marginTop: 10, opacity: 0.85 }}>
            Это пока только демо-версия — не относитесь слишком строго и серьёзно.
          </p>

          <div style={{ marginTop: 12, opacity: 0.85 }}>
            всего айтемов: {counts.total} · музыка: {counts.music} · книги: {counts.books} · фильмы: {counts.movies}
          </div>

          <button style={{ ...styles.btn, marginTop: 14 }} onClick={runVibeCheck} disabled={vibeLoading}>
            {vibeLoading ? "провожу вайбчек…" : "провести вайбчек"}
          </button>

          {vibeError && <div style={styles.error}>{vibeError}</div>}
          {summary && (
            <div
              style={{
                marginTop: 14,
                padding: 14,
                border: "1px solid #eee",
                borderRadius: 14,
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {summary}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

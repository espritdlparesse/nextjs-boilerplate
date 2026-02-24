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
  updated_at?: string;
};

function getTgInitData(): string {
  if (typeof window === "undefined") return "";
  return (window as any).Telegram?.WebApp?.initData || "";
}

function cx(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("home");

  // user label (если телега отдаёт имя)
  const [helloName, setHelloName] = useState<string>("привет!");
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    tg?.expand?.();
    const first = tg?.initDataUnsafe?.user?.first_name;
    const last = tg?.initDataUnsafe?.user?.last_name;
    const username = tg?.initDataUnsafe?.user?.username;
    const name =
      (first || last) ? [first, last].filter(Boolean).join(" ") : (username ? `@${username}` : "");
    setHelloName(name ? `привет, ${name}!` : "привет!");
  }, []);

  const tgInitData = useMemo(() => getTgInitData(), []);

  // ====== Library state ======
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string>("");
  const [items, setItems] = useState<DbItem[]>([]);

  async function loadLibrary() {
    setLibraryLoading(true);
    setLibraryError("");
    try {
      const res = await fetch(`${window.location.origin}/api/items`, {
        method: "GET",
        headers: {
          "x-telegram-init-data": tgInitData,
        },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLibraryError(json?.error ?? "Не удалось загрузить библиотеку");
        setItems([]);
        return;
      }
      setItems(Array.isArray(json?.items) ? json.items : []);
    } catch (e: any) {
      setLibraryError(e?.message ?? "Network error");
      setItems([]);
    } finally {
      setLibraryLoading(false);
    }
  }

  useEffect(() => {
    // подгружаем библиотеку сразу, чтобы в library/vibe чек было что показать
    loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====== Add content (manual) ======
  const [type, setType] = useState<ItemType | "">("");
  const [source, setSource] = useState<ItemSource | "">("");
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string>("");

  const titlePh = useMemo(() => {
    if (type === "music") return "например: Cellophane";
    if (type === "book") return "например: «Нормальные люди»";
    if (type === "movie") return "например: «Пианистка»";
    return "например: название";
  }, [type]);

  const creatorPh = useMemo(() => {
    if (type === "music") return "например: FKA twigs";
    if (type === "book") return "например: Салли Руни";
    if (type === "movie") return "например: Михаэль Ханеке";
    return "например: автор / исполнитель";
  }, [type]);

  async function addManual() {
    setManualError("");
    if (!type || !source || !title.trim()) {
      setManualError("Заполните «тип», «источник» и «название».");
      return;
    }

    setSavingManual(true);
    try {
      const res = await fetch(`${window.location.origin}/api/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": tgInitData,
        },
        body: JSON.stringify({
          type,
          source,
          title: title.trim(),
          creator: creator.trim() ? creator.trim() : null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setManualError(json?.error ?? "Не удалось добавить");
        return;
      }

      // очистить форму
      setTitle("");
      setCreator("");
      // обновить библиотеку
      await loadLibrary();
      // можно мягко переключиться в library
      setTab("library");
    } catch (e: any) {
      setManualError(e?.message ?? "Network error");
    } finally {
      setSavingManual(false);
    }
  }

  // ====== Import (image -> items) ======
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string>("");
  const [imported, setImported] = useState<ImportedItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [savingImported, setSavingImported] = useState(false);

  function toggleImported(i: number) {
    const next = new Set(selectedIdx);
    if (next.has(i)) next.delete(i);
    else next.add(i);
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

      const res = await fetch(`${window.location.origin}/api/import-image`, {
        method: "POST",
        headers: {
          "x-telegram-init-data": tgInitData,
        },
        body: form,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(json?.error ?? "Импорт не сработал");
        return;
      }

      const list: ImportedItem[] = Array.isArray(json?.items) ? json.items : [];
      setImported(list);
      setSelectedIdx(new Set(list.map((_, i) => i)));
    } catch (e: any) {
      setImportError(e?.message ?? "Network error");
    } finally {
      setImportLoading(false);
    }
  }

  async function saveSelectedImported() {
    setSavingImported(true);
    setImportError("");

    try {
      const selected = imported.filter((_, i) => selectedIdx.has(i));
      if (selected.length === 0) {
        setImportError("Нечего сохранять: снимите/поставьте галочки.");
        return;
      }

      for (const it of selected) {
        const res = await fetch(`${window.location.origin}/api/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-telegram-init-data": tgInitData,
          },
          body: JSON.stringify({
            type: it.type,
            source: it.source,
            title: it.title,
            creator: it.creator ?? null,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Не удалось сохранить");
      }

      setImported([]);
      setSelectedIdx(new Set());
      await loadLibrary();
      setTab("library");
    } catch (e: any) {
      setImportError(e?.message ?? "Save error");
    } finally {
      setSavingImported(false);
    }
  }

  // ====== Vibe check (summary) ======
  const [vibeLoading, setVibeLoading] = useState(false);
  const [vibeError, setVibeError] = useState<string>("");
  const [summary, setSummary] = useState<string>("");

  async function runVibeCheck() {
    setVibeLoading(true);
    setVibeError("");
    setSummary("");

    try {
      const res = await fetch(`${window.location.origin}/api/summary`, {
        method: "POST",
        headers: {
          "x-telegram-init-data": tgInitData,
        },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVibeError(json?.error ?? "Request failed");
        return;
      }
      setSummary(json?.summary ?? "");
    } catch (e: any) {
      setVibeError(e?.message ?? "Network error");
    } finally {
      setVibeLoading(false);
    }
  }

  const counts = useMemo(() => {
    const total = items.length;
    const music = items.filter((x) => x.type === "music").length;
    const books = items.filter((x) => x.type === "book").length;
    const movies = items.filter((x) => x.type === "movie").length;
    return { total, music, books, movies };
  }, [items]);

  // ====== UI styles (как было: жирно, пилюли, карточки) ======
  const styles = {
    page: {
      maxWidth: 720,
      margin: "0 auto",
      padding: "18px 16px 28px",
      fontFamily: "system-ui",
      color: "#111",
    } as const,
    brand: {
      fontSize: 44,
      fontWeight: 800,
      letterSpacing: -1,
      margin: "10px 0 6px",
    } as const,
    hello: { margin: "0 0 14px", fontSize: 18 } as const,
    tabsRow: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 } as const,
    tab: {
      padding: "10px 14px",
      borderRadius: 999,
      border: "1px solid #ddd",
      background: "white",
      cursor: "pointer",
      fontWeight: 600,
      textTransform: "lowercase" as const,
    },
    tabActive: {
      background: "#111",
      color: "white",
      border: "1px solid #111",
    },
    card: {
      border: "1px solid #eee",
      borderRadius: 18,
      padding: 16,
      background: "white",
      boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
    } as const,
    h2: { fontSize: 34, fontWeight: 800, margin: "0 0 10px", letterSpacing: -0.5 } as const,
    p: { margin: "10px 0", lineHeight: 1.6 } as const,
    btnPrimary: {
      width: "100%",
      padding: "14px 16px",
      borderRadius: 16,
      border: "1px solid #111",
      background: "#111",
      color: "white",
      fontWeight: 800,
      fontSize: 16,
      cursor: "pointer",
    } as const,
    btnSecondary: {
      width: "100%",
      padding: "14px 16px",
      borderRadius: 16,
      border: "1px solid #ddd",
      background: "white",
      color: "#111",
      fontWeight: 800,
      fontSize: 16,
      cursor: "pointer",
    } as const,
    btnDisabled: { opacity: 0.55, cursor: "not-allowed" } as const,
    chipRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 } as const,
    chip: {
      fontSize: 12,
      padding: "6px 10px",
      borderRadius: 999,
      background: "#f2f2f2",
      border: "1px solid #eee",
      fontWeight: 600,
      textTransform: "lowercase" as const,
    } as const,
    fieldLabel: { fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: "lowercase" as const, marginTop: 12 } as const,
    select: { width: "100%", padding: "14px 14px", borderRadius: 14, border: "1px solid #ddd", background: "white", fontSize: 16 } as const,
    input: { width: "100%", padding: "14px 14px", borderRadius: 14, border: "1px solid #ddd", background: "white", fontSize: 16 } as const,
    error: { marginTop: 10, color: "crimson", fontWeight: 600 } as const,
    listCard: { border: "1px solid #eee", borderRadius: 16, padding: 14, marginBottom: 10 } as const,
    row: { display: "flex", alignItems: "flex-start", gap: 10 } as const,
    title: { fontWeight: 800, fontSize: 18, margin: 0 } as const,
    subtitle: { margin: "4px 0 0", opacity: 0.65 } as const,
  };

  // ====== Screens ======
  function HomeScreen() {
    return (
      <div style={styles.card}>
        <div style={styles.h2}>что это</div>
        <p style={styles.p}>
          EveryYou помогает собрать весь потребляемый контент в одном месте.
          Музыка, книги, фильмы — всё фиксируется в вашей библиотеке.
        </p>
        <p style={styles.p}>
          Когда данных накопится достаточно, можно провести вайбчек и увидеть общую динамику.
        </p>

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <button style={styles.btnPrimary} onClick={() => setTab("add")}>
            → добавить контент
          </button>
          <button style={styles.btnSecondary} onClick={() => setTab("library")}>
            → открыть библиотеку
          </button>
          <button style={styles.btnSecondary} onClick={() => setTab("vibe")}>
            → вайбчек
          </button>
        </div>
      </div>
    );
  }

  function AddScreen() {
    return (
      <div style={styles.card}>
        <div style={styles.h2}>add content</div>
        <p style={styles.p}>
          импорт — чтобы быстро накидать музыки. сами добавили — чтобы внести вообще что угодно.
        </p>

        {/* import button */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            // сброс, чтобы можно было выбрать тот же файл снова
            e.currentTarget.value = "";
            if (f) runImport(f);
          }}
        />

        <button
          style={cx(JSON.stringify(styles.btnSecondary), "") as any}
          onClick={() => fileRef.current?.click()}
          disabled={importLoading}
        >
          → {importLoading ? "импортирую..." : "импорт"}
        </button>

        {importError && <div style={styles.error}>{importError}</div>}

        {imported.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {imported.map((it, i) => (
              <div key={i} style={styles.listCard}>
                <div style={styles.row}>
                  <input
                    type="checkbox"
                    checked={selectedIdx.has(i)}
                    onChange={() => toggleImported(i)}
                    style={{ marginTop: 4 }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={styles.title}>{it.title}</p>
                    {it.creator ? <p style={styles.subtitle}>{it.creator}</p> : null}
                    <div style={styles.chipRow}>
                      <span style={styles.chip}>
                        {it.type === "music" ? "музыка" : it.type === "book" ? "книги" : "фильмы"}
                      </span>
                      <span style={styles.chip}>{it.source}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              style={{
                ...styles.btnPrimary,
                ...(savingImported ? styles.btnDisabled : {}),
              }}
              disabled={savingImported}
              onClick={saveSelectedImported}
            >
              → {savingImported ? "сохраняю..." : "сохранить выбранное в библиотеку"}
            </button>
          </div>
        )}

        <div style={{ marginTop: 18, opacity: 0.7, fontWeight: 700 }}>
          импортировано: {imported.length} {imported.length === 1 ? "айтем" : "айтемов"}
        </div>

        {/* manual add */}
        <div style={styles.fieldLabel}>тип</div>
        <select
          style={styles.select}
          value={type}
          onChange={(e) => setType(e.target.value as any)}
        >
          <option value="">выберите тип</option>
          <option value="music">музыка</option>
          <option value="book">книга</option>
          <option value="movie">фильм</option>
        </select>

        <div style={styles.fieldLabel}>источник</div>
        <select
          style={styles.select}
          value={source}
          onChange={(e) => setSource(e.target.value as any)}
        >
          <option value="">выберите источник</option>
          <option value="spotify">spotify</option>
          <option value="goodreads">goodreads</option>
          <option value="letterboxd">letterboxd</option>
          <option value="manual">manual</option>
        </select>

        <div style={styles.fieldLabel}>название</div>
        <input
          style={styles.input}
          placeholder={titlePh}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div style={styles.fieldLabel}>автор / исполнитель</div>
        <input
          style={styles.input}
          placeholder={creatorPh}
          value={creator}
          onChange={(e) => setCreator(e.target.value)}
        />

        <button
          style={{
            ...styles.btnPrimary,
            marginTop: 14,
            ...(savingManual ? styles.btnDisabled : {}),
            ...(type && source && title.trim() ? {} : styles.btnDisabled),
          }}
          disabled={savingManual || !type || !source || !title.trim()}
          onClick={addManual}
        >
          → {savingManual ? "добавляю..." : "добавить в библиотеку"}
        </button>

        {manualError && <div style={styles.error}>{manualError}</div>}
      </div>
    );
  }

  function LibraryScreen() {
    return (
      <div style={styles.card}>
        <div style={styles.h2}>library</div>
        <p style={styles.p}>
          Здесь будет ваша библиотека: музыка, книги и фильмы — всё в одном месте.
        </p>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <button style={styles.btnSecondary} onClick={() => setTab("add")}>
            → добавить контент
          </button>

          <button
            style={styles.btnSecondary}
            onClick={loadLibrary}
            disabled={libraryLoading}
          >
            → {libraryLoading ? "обновляю..." : "обновить"}
          </button>
        </div>

        {libraryError && <div style={styles.error}>{libraryError}</div>}

        <div style={{ marginTop: 14, opacity: 0.8, fontWeight: 700 }}>
          всего айтемов: {counts.total} · музыка: {counts.music} · книги: {counts.books} · фильмы: {counts.movies}
        </div>

        <div style={{ marginTop: 14 }}>
          {items.length === 0 && !libraryLoading ? (
            <div style={{ opacity: 0.7 }}>
              Пока пусто. Добавьте пару айтемов — и библиотека оживёт.
            </div>
          ) : null}

          {items.map((it) => (
            <div key={String(it.id)} style={styles.listCard}>
              <p style={styles.title}>{it.title}</p>
              {it.creator ? <p style={styles.subtitle}>{it.creator}</p> : null}
              <div style={styles.chipRow}>
                <span style={styles.chip}>
                  {it.type === "music" ? "музыка" : it.type === "book" ? "книги" : "фильмы"}
                </span>
                <span style={styles.chip}>{it.source}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function VibeScreen() {
    return (
      <div style={styles.card}>
        <div style={styles.h2}>вайбчек</div>
        <p style={styles.p}>
          Здесь можно провести вайбчек всей вашей библиотеки.
          Алгоритм анализирует сохранённый контент и собирает общий портрет периода.
        </p>
        <p style={styles.p}>
          Это пока только демо-версия — не относитесь слишком строго и серьёзно.
        </p>

        <div style={{ marginTop: 10, opacity: 0.8, fontWeight: 700 }}>
          всего айтемов: {counts.total} · музыка: {counts.music} · книги: {counts.books} · фильмы: {counts.movies}
        </div>

        <button
          style={{
            ...styles.btnPrimary,
            marginTop: 14,
            ...(vibeLoading ? styles.btnDisabled : {}),
          }}
          disabled={vibeLoading}
          onClick={runVibeCheck}
        >
          {vibeLoading ? "провожу вайбчек…" : "провести вайбчек"}
        </button>

        {vibeError && <div style={styles.error}>{vibeError}</div>}

        {summary && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              border: "1px solid #eee",
              borderRadius: 16,
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
            }}
          >
            {summary}
          </div>
        )}
      </div>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.brand}>everyyou</div>
      <div style={styles.hello}>{helloName}</div>

      <div style={styles.tabsRow}>
        <button
          style={{ ...styles.tab, ...(tab === "home" ? styles.tabActive : {}) }}
          onClick={() => setTab("home")}
        >
          home
        </button>
        <button
          style={{ ...styles.tab, ...(tab === "add" ? styles.tabActive : {}) }}
          onClick={() => setTab("add")}
        >
          add content
        </button>
        <button
          style={{ ...styles.tab, ...(tab === "library" ? styles.tabActive : {}) }}
          onClick={() => setTab("library")}
        >
          library
        </button>
        <button
          style={{ ...styles.tab, ...(tab === "vibe" ? styles.tabActive : {}) }}
          onClick={() => setTab("vibe")}
        >
          vibe check
        </button>
      </div>

      {tab === "home" ? <HomeScreen /> : null}
      {tab === "add" ? <AddScreen /> : null}
      {tab === "library" ? <LibraryScreen /> : null}
      {tab === "vibe" ? <VibeScreen /> : null}

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.55 }}>
        telegram webapp: detected · ready: yes
      </div>
    </main>
  );
}

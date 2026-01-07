"use client";

import React, { useEffect, useMemo, useState } from "react";

type ContentType = "music" | "book" | "movie";
type SourceType = "manual" | "import_spotify";

type LibraryItem = {
  id: string;
  type: ContentType;
  source: SourceType;
  title: string;
  creator: string; // author / artist / director
  vibe?: string; // optional
  createdAt: number;
};

const STORAGE_KEY_LIBRARY = "everyyou_library_v1";
const STORAGE_KEY_IMPORTED = "everyyou_imported_tracks_v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getCreatorLabel(type: ContentType | "") {
  if (type === "music") return "исполнитель";
  if (type === "book") return "автор";
  if (type === "movie") return "режиссёр";
  return "автор / исполнитель";
}

function getTitlePlaceholder(type: ContentType | "") {
  if (type === "music") return "например: about today";
  if (type === "movie") return "например: lost in translation";
  if (type === "book") return "например: a ghost in the throat";
  return "например: название";
}

function getCreatorPlaceholder(type: ContentType | "") {
  if (type === "music") return "например: the national";
  if (type === "movie") return "например: sofia coppola";
  if (type === "book") return "например: doireann ní ghríofa";
  return "например: автор";
}

function badgeStyle(kind: "type" | "source" | "vibe", value?: string) {
  // намеренно мягкие цвета, чтобы не «кричало»
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1,
  };

  // чуть разные оттенки по смыслу
  if (kind === "type") {
    if (value === "music") return { ...base, background: "rgba(0, 122, 255, 0.10)" };
    if (value === "book") return { ...base, background: "rgba(52, 199, 89, 0.12)" };
    if (value === "movie") return { ...base, background: "rgba(175, 82, 222, 0.12)" };
    return { ...base, background: "rgba(0,0,0,0.06)" };
  }

  if (kind === "source") {
    if (value === "manual") return { ...base, background: "rgba(255, 149, 0, 0.14)" };
    if (value === "import_spotify") return { ...base, background: "rgba(48, 209, 88, 0.14)" };
    return { ...base, background: "rgba(0,0,0,0.06)" };
  }

  // vibe
  if (!value) return { ...base, background: "rgba(0,0,0,0.06)" };

  const map: Record<string, React.CSSProperties> = {
    "всё бесит": { background: "rgba(255, 59, 48, 0.12)" },
    "тупо": { background: "rgba(255, 204, 0, 0.16)" },
    "круто": { background: "rgba(52, 199, 89, 0.14)" },
    "не круто": { background: "rgba(142, 142, 147, 0.14)" },
    "нужно для дела": { background: "rgba(0, 122, 255, 0.10)" },
    "хочу вдохновиться": { background: "rgba(175, 82, 222, 0.12)" },
    "подумать/переварить": { background: "rgba(90, 200, 250, 0.14)" },
    "хз если честно": { background: "rgba(162, 132, 94, 0.14)" },
  };

  return { ...base, ...(map[value] ?? { background: "rgba(0,0,0,0.06)" }) };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"home" | "add" | "library" | "analysis">("home");

  // базовый “привет”
  const [tgName, setTgName] = useState<string>("настя");

  // library
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [filterVibe, setFilterVibe] = useState<string>("__all__");

  // import
  const [importing, setImporting] = useState(false);
  const [importedTracks, setImportedTracks] = useState<number>(0);
  const [importStatus, setImportStatus] = useState<string>("");

  // add/edit form
  const [editingId, setEditingId] = useState<string | null>(null);

  const [type, setType] = useState<ContentType | "">("");
  const [source, setSource] = useState<SourceType | "">("");
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [vibe, setVibe] = useState<string>(""); // empty allowed

  const vibeOptions = useMemo(
    () => [
      { value: "", label: "ничего" }, // empty (allowed)
      { value: "всё бесит", label: "всё бесит" },
      { value: "тупо", label: "тупо" },
      { value: "круто", label: "круто" },
      { value: "не круто", label: "не круто" },
      { value: "нужно для дела", label: "нужно для дела" },
      { value: "хочу вдохновиться", label: "хочу вдохновиться" },
      { value: "подумать/переварить", label: "подумать/переварить" },
      { value: "хз если честно", label: "хз если честно" },
    ],
    []
  );

  const typeOptions = useMemo(
    () => [
      { value: "", label: "выберите тип" },
      { value: "music", label: "музыка" },
      { value: "book", label: "книга" },
      { value: "movie", label: "фильм" },
    ],
    []
  );

  const sourceOptions = useMemo(
    () => [
      { value: "", label: "выберите источник" },
      { value: "manual", label: "вручную" },
      { value: "import_spotify", label: "spotify (скоро)" },
    ],
    []
  );

  // загрузка localStorage + telegram user
  useEffect(() => {
    // library
    const stored = safeJsonParse<LibraryItem[]>(localStorage.getItem(STORAGE_KEY_LIBRARY), []);
    setItems(stored);

    // import stats
    const storedImported = Number(localStorage.getItem(STORAGE_KEY_IMPORTED) ?? "0");
    setImportedTracks(Number.isFinite(storedImported) ? storedImported : 0);

    // telegram user name (если открыто внутри tg)
    const tg = (window as any)?.Telegram?.WebApp;
    const first = tg?.initDataUnsafe?.user?.first_name;
    const last = tg?.initDataUnsafe?.user?.last_name;
    const pretty = [first, last].filter(Boolean).join(" ").trim();
    if (pretty) setTgName(pretty);
  }, []);

  // сохраняем library
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(items));
  }, [items]);

  // сохраняем импорт
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_IMPORTED, String(importedTracks));
  }, [importedTracks]);

  const filteredItems = useMemo(() => {
    if (filterVibe === "__all__") return items;
    if (filterVibe === "__empty__") return items.filter((x) => !x.vibe);
    return items.filter((x) => (x.vibe ?? "") === filterVibe);
  }, [items, filterVibe]);

  const canSubmit =
    type !== "" &&
    source !== "" &&
    title.trim().length > 0 &&
    creator.trim().length > 0 &&
    !importing;

  function resetForm() {
    setEditingId(null);
    setType("");
    setSource("");
    setTitle("");
    setCreator("");
    setVibe("");
  }

  function startEdit(item: LibraryItem) {
    setEditingId(item.id);
    setType(item.type);
    setSource(item.source);
    setTitle(item.title);
    setCreator(item.creator);
    setVibe(item.vibe ?? "");
    setActiveTab("add");
  }

  function submitForm() {
    if (!canSubmit) return;

    if (editingId) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === editingId
            ? {
                ...x,
                type: type as ContentType,
                source: source as SourceType,
                title: title.trim(),
                creator: creator.trim(),
                vibe: vibe || undefined,
              }
            : x
        )
      );
      resetForm();
      setActiveTab("library");
      return;
    }

    const newItem: LibraryItem = {
      id: uid(),
      type: type as ContentType,
      source: source as SourceType,
      title: title.trim(),
      creator: creator.trim(),
      vibe: vibe || undefined,
      createdAt: Date.now(),
    };

    setItems((prev) => [newItem, ...prev]);
    resetForm();
    setActiveTab("library");
  }

  function deleteItem(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  async function runFakeImport() {
    if (importing) return;
    setImporting(true);
    setImportStatus("тянем данные…");

    // фейковая загрузка (потом заменим на реальный запрос)
    await new Promise((r) => setTimeout(r, 900));
    setImportStatus("почти…");

    await new Promise((r) => setTimeout(r, 700));
    const delta = 25 + Math.floor(Math.random() * 120); // “импортировано N треков”
    setImportedTracks((n) => n + delta);

    setImportStatus(`готово: импортировано ${delta} треков`);
    await new Promise((r) => setTimeout(r, 900));

    setImportStatus("");
    setImporting(false);
  }

  const styles = {
    page: {
      padding: 24,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    } as React.CSSProperties,
    header: { marginBottom: 10 } as React.CSSProperties,
    h1: { margin: 0, fontSize: 28, fontWeight: 800 } as React.CSSProperties,
    hello: { marginTop: 6, opacity: 0.85, fontSize: 18 } as React.CSSProperties,

    tabsRow: { display: "flex", gap: 10, marginTop: 14 } as React.CSSProperties,
    tab: (active: boolean) =>
      ({
        borderRadius: 999,
        padding: "10px 14px",
        border: "1px solid rgba(0,0,0,0.12)",
        background: active ? "#000" : "#fff",
        color: active ? "#fff" : "#000",
        fontWeight: 700,
        textTransform: "lowercase",
      }) as React.CSSProperties,

    card: {
      marginTop: 16,
      borderRadius: 18,
      border: "1px solid rgba(0,0,0,0.12)",
      padding: 16,
      background: "#fff",
    } as React.CSSProperties,

    label: { fontSize: 14, fontWeight: 800, opacity: 0.75, marginTop: 14 } as React.CSSProperties,

    select: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 14,
      border: "1px solid rgba(0,0,0,0.12)",
      fontSize: 16,
      fontWeight: 700,
      outline: "none",
      background: "#fff",
    } as React.CSSProperties,

    input: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 14,
      border: "1px solid rgba(0,0,0,0.12)",
      fontSize: 16,
      fontWeight: 700,
      outline: "none",
    } as React.CSSProperties,

    hint: { marginTop: 8, opacity: 0.7, fontWeight: 600 } as React.CSSProperties,

    primaryBtn: (disabled: boolean) =>
      ({
        width: "100%",
        marginTop: 14,
        padding: "14px 16px",
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.12)",
        background: disabled ? "rgba(0,0,0,0.12)" : "#000",
        color: disabled ? "rgba(0,0,0,0.55)" : "#fff",
        fontWeight: 800,
        fontSize: 16,
      }) as React.CSSProperties,

    secondaryBtn: (disabled: boolean) =>
      ({
        width: "100%",
        marginTop: 10,
        padding: "14px 16px",
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.12)",
        background: disabled ? "rgba(0,0,0,0.06)" : "#fff",
        color: "#000",
        fontWeight: 800,
        fontSize: 16,
      }) as React.CSSProperties,

    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 12,
      marginTop: 14,
    } as React.CSSProperties,

    tile: {
      borderRadius: 22,
      border: "1px solid rgba(0,0,0,0.12)",
      padding: 14,
      background: "#fff",
    } as React.CSSProperties,

    tileTitle: { margin: 0, fontSize: 20, fontWeight: 900 } as React.CSSProperties,
    tileCreator: { marginTop: 6, marginBottom: 10, fontSize: 16, fontWeight: 800, opacity: 0.75 } as React.CSSProperties,

    badgesRow: { display: "flex", gap: 10, flexWrap: "wrap" as const } as React.CSSProperties,

    tileActions: { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 12 } as React.CSSProperties,
    actionBtn: (kind: "edit" | "delete") =>
      ({
        width: "100%",
        padding: "12px 14px",
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.12)",
        background: kind === "delete" ? "rgba(255, 59, 48, 0.10)" : "#fff",
        fontWeight: 900,
        fontSize: 16,
      }) as React.CSSProperties,
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.h1}>everyyou</h1>
        <div style={styles.hello}>привет, {tgName} 👋</div>

        <div style={styles.tabsRow}>
          <button style={styles.tab(activeTab === "home")} onClick={() => setActiveTab("home")}>
            home
          </button>
          <button style={styles.tab(activeTab === "add")} onClick={() => setActiveTab("add")}>
            add content
          </button>
          <button style={styles.tab(activeTab === "library")} onClick={() => setActiveTab("library")}>
            library
          </button>
          <button style={styles.tab(activeTab === "analysis")} onClick={() => setActiveTab("analysis")}>
            analysis
          </button>
        </div>
      </header>

      {activeTab === "home" && (
        <section style={styles.card}>
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 700, opacity: 0.85 }}>
            everyyou собирает весь ваш контент в одном месте — книги, фильмы, музыку.
            потом помогает понять, как это влияет на настроение и состояние.
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <button style={styles.primaryBtn(false)} onClick={() => setActiveTab("add")}>
              → add content
            </button>
            <button style={styles.secondaryBtn(false)} onClick={() => setActiveTab("library")}>
              → library
            </button>
            <button style={styles.secondaryBtn(false)} onClick={() => setActiveTab("analysis")}>
              → analysis
            </button>
          </div>
        </section>
      )}

      {activeTab === "add" && (
        <section style={styles.card}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 22, fontWeight: 900 }}>add content</h2>
          <p style={{ marginTop: 0, marginBottom: 12, fontWeight: 650, opacity: 0.8 }}>
            пока тут ручное добавление. дальше подключим spotify / goodreads / letterboxd.
          </p>

          <button style={styles.secondaryBtn(importing)} onClick={runFakeImport} disabled={importing}>
            {importing ? "тянем данные…" : "импорт"}
          </button>
          {importStatus ? (
            <div style={{ marginTop: 8, opacity: 0.75, fontWeight: 700 }}>{importStatus}</div>
          ) : (
            <div style={{ marginTop: 8, opacity: 0.75, fontWeight: 700 }}>
              импортировано всего: {importedTracks} треков
            </div>
          )}

          <div style={styles.label}>тип</div>
          <select value={type} onChange={(e) => setType(e.target.value as any)} style={styles.select}>
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div style={styles.label}>источник</div>
          <select value={source} onChange={(e) => setSource(e.target.value as any)} style={styles.select}>
            {sourceOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div style={styles.label}>название</div>
          <input
            style={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={getTitlePlaceholder(type)}
            autoComplete="off"
            inputMode="text"
          />

          <div style={styles.label}>{getCreatorLabel(type)}</div>
          <input
            style={styles.input}
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            placeholder={getCreatorPlaceholder(type)}
            autoComplete="off"
            inputMode="text"
          />

          <div style={styles.label}>тэги/вайбы</div>
          <select value={vibe} onChange={(e) => setVibe(e.target.value)} style={styles.select}>
            {vibeOptions.map((o) => (
              <option key={o.value || "__empty"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div style={styles.hint}>сейчас выбрано: {vibe ? vibe : "ничего"}, это поле можно оставить пустым</div>

          <button style={styles.primaryBtn(!canSubmit)} onClick={submitForm} disabled={!canSubmit}>
            {editingId ? "→ сохранить изменения" : "→ добавить в библиотеку"}
          </button>

          {editingId ? (
            <button
              style={styles.secondaryBtn(false)}
              onClick={() => {
                resetForm();
              }}
            >
              отменить редактирование
            </button>
          ) : null}
        </section>
      )}

      {activeTab === "library" && (
        <section style={styles.card}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 22, fontWeight: 900 }}>library</h2>

          <div style={styles.label}>фильтр по тэги/вайбы</div>
          <select value={filterVibe} onChange={(e) => setFilterVibe(e.target.value)} style={styles.select}>
            <option value="__all__">все</option>
            <option value="__empty__">без вайба</option>
            {vibeOptions
              .filter((v) => v.value !== "")
              .map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
          </select>

          {filteredItems.length === 0 ? (
            <div style={{ marginTop: 14, opacity: 0.7, fontWeight: 700 }}>пока пусто. добавим что-нибудь?</div>
          ) : (
            <div style={styles.grid}>
              {filteredItems.map((it) => (
                <div key={it.id} style={styles.tile}>
                  <h3 style={styles.tileTitle}>{it.title}</h3>
                  <div style={styles.tileCreator}>{it.creator}</div>

                  <div style={styles.badgesRow}>
                    <span style={badgeStyle("type", it.type)}>{it.type === "music" ? "музыка" : it.type === "book" ? "книга" : "фильм"}</span>
                    <span style={badgeStyle("source", it.source)}>{it.source === "manual" ? "вручную" : "spotify"}</span>
                    <span style={badgeStyle("vibe", it.vibe)}>{it.vibe ? it.vibe : "без вайба"}</span>
                  </div>

                  <div style={styles.tileActions}>
                    <button style={styles.actionBtn("edit")} onClick={() => startEdit(it)}>
                      редактировать
                    </button>
                    <button style={styles.actionBtn("delete")} onClick={() => deleteItem(it.id)}>
                      удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "analysis" && (
        <section style={styles.card}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 22, fontWeight: 900 }}>analysis</h2>
          <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 700, opacity: 0.8 }}>
            период + вайбчек (сделаем дальше).
          </p>
          <div style={{ opacity: 0.75, fontWeight: 700 }}>
            пока тут заглушка: позже добавим выбор периода и анализ библиотеки.
          </div>
        </section>
      )}
    </main>
  );
}
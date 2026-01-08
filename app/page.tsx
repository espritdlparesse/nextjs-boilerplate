"use client";

import { useEffect, useMemo, useState } from "react";

type TgUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type ContentType = "music" | "book" | "film";
type SourceType = "manual" | "import_spotify";

type LibraryItem = {
  id: string;
  type: ContentType;
  source: SourceType;
  title: string;
  authorOrArtist: string;
  createdAt: number; // ms
};

type Tab = "home" | "add" | "library" | "analysis";
type Period = "7d" | "30d" | "90d" | "all";

type AnalysisRun = {
  id: string;
  period: Period;
  from: number;
  to: number;
  createdAt: number;
  itemCount: number;
  summary: string;
  highlights: string[];
};

const TYPE_LABEL: Record<ContentType, string> = {
  music: "музыка",
  book: "книга",
  film: "фильм",
};

const SOURCE_LABEL: Record<SourceType, string> = {
  manual: "вручную",
  import_spotify: "импорт",
};

const PLACEHOLDERS: Record<ContentType, Array<{ title: string; authorOrArtist: string }>> = {
  music: [
    { title: "about today", authorOrArtist: "the national" },
    { title: "codex", authorOrArtist: "radiohead" },
    { title: "movies", authorOrArtist: "weyes blood" },
    { title: "i know the end", authorOrArtist: "phoebe bridgers" },
    { title: "cellophane", authorOrArtist: "fka twigs" },
    { title: "not strong enough", authorOrArtist: "boygenius" },
    { title: "seventeen", authorOrArtist: "sharon van etten" },
    { title: "sparks", authorOrArtist: "beach house" },
    { title: "the rip", authorOrArtist: "portishead" },
    { title: "night shift", authorOrArtist: "lucy dacus" },
  ],
  film: [
    { title: "lost in translation", authorOrArtist: "sofia coppola" },
    { title: "personal shopper", authorOrArtist: "olivier assayas" },
    { title: "american beauty", authorOrArtist: "sam mendes" },
    { title: "her", authorOrArtist: "spike jonze" },
    { title: "under the skin", authorOrArtist: "jonathan glazer" },
    { title: "melancholia", authorOrArtist: "lars von trier" },
    { title: "the lobster", authorOrArtist: "yorgos lanthimos" },
    { title: "drive my car", authorOrArtist: "ryusuke hamaguchi" },
    { title: "eternal sunshine", authorOrArtist: "michel gondry" },
    { title: "call me by your name", authorOrArtist: "luca guadagnino" },
  ],
  book: [
    { title: "hot milk", authorOrArtist: "deborah levy" },
    { title: "the cost of living", authorOrArtist: "deborah levy" },
    { title: "how should a person be?", authorOrArtist: "sheila heti" },
    { title: "motherhood", authorOrArtist: "sheila heti" },
    { title: "simple passion", authorOrArtist: "annie ernaux" },
    { title: "the years", authorOrArtist: "annie ernaux" },
    { title: "outline", authorOrArtist: "rachel cusk" },
    { title: "second place", authorOrArtist: "rachel cusk" },
    { title: "weather", authorOrArtist: "jenny offill" },
    { title: "dept. of speculation", authorOrArtist: "jenny offill" },
  ],
};

const STORAGE_KEY_LIBRARY = "everyyou.library.v2";
const STORAGE_KEY_IMPORT = "everyyou.import.v2";
const STORAGE_KEY_ANALYSIS = "everyyou.analysis.v1";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampText(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatShortDate(ms: number) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }).toLowerCase();
}

function formatFullDate(ms: number) {
  const d = new Date(ms);
  return d
    .toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toLowerCase();
}

function baseBadge(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.10)",
    fontSize: 14,
    lineHeight: "16px",
    fontWeight: 800,
    textTransform: "lowercase",
    whiteSpace: "nowrap",
  };
}

function typeBadgeStyle(type: ContentType): React.CSSProperties {
  const map: Record<ContentType, React.CSSProperties> = {
    music: { background: "rgba(99,102,241,0.16)", borderColor: "rgba(99,102,241,0.35)" }, // индиго
    book: { background: "rgba(168,85,247,0.16)", borderColor: "rgba(168,85,247,0.35)" }, // фиолетовый
    film: { background: "rgba(236,72,153,0.14)", borderColor: "rgba(236,72,153,0.32)" }, // розовый
  };
  return { ...baseBadge(), ...map[type] };
}

function sourceBadgeStyle(source: SourceType): React.CSSProperties {
  const map: Record<SourceType, React.CSSProperties> = {
    manual: { background: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.30)" }, // зелёный
    import_spotify: { background: "rgba(14,165,233,0.14)", borderColor: "rgba(14,165,233,0.30)" }, // голубой
  };
  return { ...baseBadge(), ...map[source] };
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");

  const [hasTg, setHasTg] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<TgUser | null>(null);

  // add form
  const [type, setType] = useState<ContentType | "">("");
  const [source, setSource] = useState<SourceType | "">("");
  const [title, setTitle] = useState("");
  const [authorOrArtist, setAuthorOrArtist] = useState("");

  // placeholder rotation
  const [phIdx, setPhIdx] = useState(0);

  // library
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<ContentType | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<SourceType | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // edit
  const [editingId, setEditingId] = useState<string | null>(null);

  // import
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(STORAGE_KEY_IMPORT);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  });

  // analysis
  const [period, setPeriod] = useState<Period>("30d");
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisRun[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisRun | null>(null);

  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg) {
      setHasTg(false);
      return;
    }
    setHasTg(true);
    tg.ready();
    setReady(true);
    setUser(tg.initDataUnsafe?.user ?? null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLibrary(safeParse<LibraryItem[]>(window.localStorage.getItem(STORAGE_KEY_LIBRARY), []));
    setAnalysisHistory(safeParse<AnalysisRun[]>(window.localStorage.getItem(STORAGE_KEY_ANALYSIS), []));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(library));
  }, [library]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY_IMPORT, String(importedCount));
  }, [importedCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY_ANALYSIS, JSON.stringify(analysisHistory));
  }, [analysisHistory]);

  useEffect(() => {
    const id = window.setInterval(() => setPhIdx((i) => i + 1), 2500);
    return () => window.clearInterval(id);
  }, []);

  const displayName = useMemo(() => {
    const first = user?.first_name?.trim();
    const last = user?.last_name?.trim();
    const s = [first, last].filter(Boolean).join(" ").trim();
    return s || "друг";
  }, [user]);

  const activeType: ContentType = (type || "music") as ContentType;
  const phList = PLACEHOLDERS[activeType];
  const currentPh = phList[phIdx % phList.length];

  const canSave = useMemo(() => {
    return Boolean(type && source && clampText(title) && clampText(authorOrArtist));
  }, [type, source, title, authorOrArtist]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return library.find((x) => x.id === selectedId) ?? null;
  }, [selectedId, library]);

  const visibleLibrary = useMemo(() => {
    return library.filter((x) => {
      const okType = typeFilter === "all" ? true : x.type === typeFilter;
      const okSource = sourceFilter === "all" ? true : x.source === sourceFilter;
      return okType && okSource;
    });
  }, [library, typeFilter, sourceFilter]);

  const analysisRange = useMemo(() => {
    const now = Date.now();
    if (period === "all") return { from: 0, to: now };
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    return { from: now - days * 24 * 60 * 60 * 1000, to: now };
  }, [period]);

  const analysisItems = useMemo(() => {
    return library.filter((x) => x.createdAt >= analysisRange.from && x.createdAt <= analysisRange.to);
  }, [library, analysisRange]);

  const analysisCounters = useMemo(() => {
    const byType: Record<ContentType, number> = { music: 0, book: 0, film: 0 };
    const bySource: Record<SourceType, number> = { manual: 0, import_spotify: 0 };
    for (const it of analysisItems) {
      byType[it.type] += 1;
      bySource[it.source] += 1;
    }
    return { byType, bySource, total: analysisItems.length };
  }, [analysisItems]);

  function resetForm() {
    setType("");
    setSource("");
    setTitle("");
    setAuthorOrArtist("");
  }

  function createItem(): LibraryItem {
    return {
      id: uid(),
      type: type as ContentType,
      source: source as SourceType,
      title: clampText(title).toLowerCase(),
      authorOrArtist: clampText(authorOrArtist).toLowerCase(),
      createdAt: Date.now(),
    };
  }

  function addItem() {
    if (!canSave) return;
    const item = createItem();
    setLibrary((prev) => [item, ...prev]);
    resetForm();
    setTab("library");
    setSelectedId(item.id);
  }

  function startEdit(id: string) {
    const it = library.find((x) => x.id === id);
    if (!it) return;
    setEditingId(id);
    setTab("add");
    setType(it.type);
    setSource(it.source);
    setTitle(it.title);
    setAuthorOrArtist(it.authorOrArtist);
  }

  function saveEdit() {
    if (!editingId) return;
    if (!canSave) return;

    setLibrary((prev) =>
      prev.map((x) => {
        if (x.id !== editingId) return x;
        return {
          ...x,
          type: type as ContentType,
          source: source as SourceType,
          title: clampText(title).toLowerCase(),
          authorOrArtist: clampText(authorOrArtist).toLowerCase(),
        };
      })
    );

    const id = editingId;
    setEditingId(null);
    resetForm();
    setTab("library");
    setSelectedId(id);
  }

  function removeItem(id: string) {
    setLibrary((prev) => prev.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }

  async function runFakeImport() {
    if (isImporting) return;
    setIsImporting(true);

    await new Promise((r) => setTimeout(r, 900));
    const plus = 37;
    setImportedCount((n) => n + plus);

    const now = Date.now();
    const fake: LibraryItem[] = [
      {
        id: uid(),
        type: "music",
        source: "import_spotify",
        title: "about today",
        authorOrArtist: "the national",
        createdAt: now,
      },
      {
        id: uid(),
        type: "music",
        source: "import_spotify",
        title: "codex",
        authorOrArtist: "radiohead",
        createdAt: now - 60_000,
      },
    ];

    setLibrary((prev) => [...fake, ...prev]);
    setIsImporting(false);
    setTab("library");
  }

  function periodLabel(p: Period) {
    if (p === "7d") return "последние 7 дней";
    if (p === "30d") return "последние 30 дней";
    if (p === "90d") return "последние 90 дней";
    return "за всё время";
  }

  async function runFakeAnalysis() {
    if (analysisRunning) return;
    setAnalysisRunning(true);

    // имитация работы gpt
    await new Promise((r) => setTimeout(r, 900));

    const total = analysisCounters.total;
    const t = analysisCounters.byType;
    const s = analysisCounters.bySource;

    const summary =
      total === 0
        ? "похоже, в этом периоде пока нечего анализировать. добавьте пару айтемов — и вернёмся."
        : `за ${periodLabel(period).toLowerCase()} у вас ${total} айтемов: музыка — ${t.music}, книги — ${t.book}, фильмы — ${t.film}. дальше gpt будет читать сами названия и автора/исполнителя, чтобы собрать вайбчек без ручных тегов.`;

    const highlights =
      total === 0
        ? ["первый шаг — добавить контент в библиотеку", "можно начать с импорта spotify"]
        : [
            `источник: вручную — ${s.manual}, импорт — ${s.import_spotify}`,
            "следующий шаг — подключить spotify и реальный gpt-анализ",
            "в будущем: сохранённые вайбчеки и сравнение периодов",
          ];

    const result: AnalysisRun = {
      id: uid(),
      period,
      from: analysisRange.from,
      to: analysisRange.to,
      createdAt: Date.now(),
      itemCount: total,
      summary,
      highlights,
    };

    setAnalysisResult(result);
    setAnalysisHistory((prev) => [result, ...prev].slice(0, 30));
    setAnalysisRunning(false);
  }

  function deleteAnalysisRun(id: string) {
    setAnalysisHistory((prev) => prev.filter((x) => x.id !== id));
    if (analysisResult?.id === id) setAnalysisResult(null);
  }

  // styles
  const pageWrap: React.CSSProperties = {
    padding: 24,
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  };

  const h1: React.CSSProperties = { margin: "0 0 8px 0", fontSize: 28, fontWeight: 950 };
  const h2: React.CSSProperties = { margin: "0 0 10px 0", fontSize: 22, fontWeight: 950, textTransform: "lowercase" };

  const helper: React.CSSProperties = { margin: "0 0 10px 0", opacity: 0.82, lineHeight: "22px" };

  const tabs: React.CSSProperties = { display: "flex", gap: 10, margin: "12px 0 16px 0" };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: active ? "black" : "white",
    color: active ? "white" : "black",
    fontWeight: 900,
    textTransform: "lowercase",
  });

  const card: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 16,
    padding: 16,
    background: "white",
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 950,
    opacity: 0.65,
    marginTop: 14,
    marginBottom: 6,
    textTransform: "lowercase",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.14)",
    fontSize: 16,
    outline: "none",
  };

  const select: React.CSSProperties = { ...input, appearance: "none", background: "white" };

  const primaryBtn: React.CSSProperties = {
    width: "100%",
    marginTop: 16,
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "black",
    color: "white",
    fontSize: 16,
    fontWeight: 950,
    textTransform: "lowercase",
  };

  const secondaryBtn: React.CSSProperties = {
    width: "100%",
    marginTop: 10,
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    color: "black",
    fontSize: 16,
    fontWeight: 950,
    textTransform: "lowercase",
  };

  const disabledBtn: React.CSSProperties = {
    ...primaryBtn,
    background: "rgba(0,0,0,0.18)",
    color: "rgba(0,0,0,0.55)",
  };

  const editBtn: React.CSSProperties = {
    ...secondaryBtn,
    borderColor: "rgba(59,130,246,0.45)",
    background: "rgba(59,130,246,0.10)",
  };

  const dangerBtn: React.CSSProperties = {
    ...secondaryBtn,
    borderColor: "rgba(239,68,68,0.45)",
    background: "rgba(239,68,68,0.10)",
  };

  const pillRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 };

  const tile: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 18,
    padding: 16,
    background: "white",
  };

  return (
    <main style={pageWrap}>
      <h1 style={h1}>everyyou</h1>
      <p style={{ margin: 0, opacity: 0.85, lineHeight: "22px" }}>
        привет, {displayName.toLowerCase()} 👋
      </p>

      <div style={tabs}>
        <button style={tabBtn(tab === "home")} onClick={() => setTab("home")}>home</button>
        <button style={tabBtn(tab === "add")} onClick={() => setTab("add")}>add content</button>
        <button style={tabBtn(tab === "library")} onClick={() => setTab("library")}>library</button>
        <button style={tabBtn(tab === "analysis")} onClick={() => setTab("analysis")}>analysis</button>
      </div>

      {/* home */}
      {tab === "home" && (
        <section style={card}>
          <h2 style={h2}>что это</h2>
          <p style={helper}>
            everyyou собирает весь ваш контент в одном месте — книги, фильмы, музыку. затем помогает
            понять, как всё это влияет на настроение и состояние, и подобрать слова для вайбчека.
          </p>

          <button style={primaryBtn} onClick={() => setTab("add")}>→ добавить контент</button>
          <button style={secondaryBtn} onClick={() => setTab("library")}>→ открыть библиотеку</button>
          <button style={secondaryBtn} onClick={() => setTab("analysis")}>→ вайбчек</button>

          <div style={{ marginTop: 14, opacity: 0.65, fontSize: 13, lineHeight: "18px" }}>
            telegram webapp: {hasTg ? "detected" : "not detected"} · ready: {ready ? "yes" : "no"}
          </div>
        </section>
      )}

      {/* add */}
      {tab === "add" && (
        <section style={card}>
          <h2 style={h2}>{editingId ? "редактировать" : "add content"}</h2>

          <p style={{ ...helper, marginBottom: 8 }}>
            импорт — чтобы быстро накидать контента и не страдать. ручной ввод — чтобы добавлять что угодно.
          </p>

          <button style={isImporting ? disabledBtn : secondaryBtn} onClick={runFakeImport} disabled={isImporting}>
            {isImporting ? "тянем данные…" : "импорт"}
          </button>
          <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13, textTransform: "lowercase" }}>
            импортировано: {importedCount} треков
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={fieldLabel}>тип</div>
            <select style={select} value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="">выберите тип</option>
              <option value="music">музыка</option>
              <option value="book">книга</option>
              <option value="film">фильм</option>
            </select>

            <div style={fieldLabel}>источник</div>
            <select style={select} value={source} onChange={(e) => setSource(e.target.value as any)}>
              <option value="">выберите источник</option>
              <option value="manual">вручную</option>
              <option value="import_spotify">импорт</option>
            </select>

            <div style={fieldLabel}>название</div>
            <input
              style={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`например: ${currentPh.title}`}
              autoCorrect="off"
              autoCapitalize="none"
            />

            <div style={fieldLabel}>
              {type === "film" ? "режиссёр / автор" : type === "book" ? "автор" : "автор / исполнитель"}
            </div>
            <input
              style={input}
              value={authorOrArtist}
              onChange={(e) => setAuthorOrArtist(e.target.value)}
              placeholder={`например: ${currentPh.authorOrArtist}`}
              autoCorrect="off"
              autoCapitalize="none"
            />

            {!editingId ? (
              <button style={canSave ? primaryBtn : disabledBtn} onClick={addItem} disabled={!canSave}>
                → добавить в библиотеку
              </button>
            ) : (
              <>
                <button style={canSave ? primaryBtn : disabledBtn} onClick={saveEdit} disabled={!canSave}>
                  → сохранить
                </button>
                <button
                  style={secondaryBtn}
                  onClick={() => {
                    setEditingId(null);
                    resetForm();
                    setTab("library");
                  }}
                >
                  → отмена
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {/* library */}
      {tab === "library" && (
        <section style={card}>
          <h2 style={h2}>library</h2>

          <div style={fieldLabel}>фильтры</div>
          <select
            style={select}
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as any);
              setSelectedId(null);
            }}
          >
            <option value="all">все типы</option>
            <option value="music">музыка</option>
            <option value="book">книга</option>
            <option value="film">фильм</option>
          </select>

          <select
            style={{ ...select, marginTop: 10 }}
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value as any);
              setSelectedId(null);
            }}
          >
            <option value="all">все источники</option>
            <option value="manual">вручную</option>
            <option value="import_spotify">импорт</option>
          </select>

          {/* detail */}
          {selectedItem && (
            <div style={{ marginTop: 16, ...tile }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 950, marginBottom: 6, textTransform: "lowercase" }}>
                    {selectedItem.title}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 850, opacity: 0.78, textTransform: "lowercase" }}>
                    {selectedItem.authorOrArtist}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.65, textTransform: "lowercase" }}>
                    добавлено: {formatFullDate(selectedItem.createdAt)}
                  </div>
                </div>

                <button
                  style={{ ...secondaryBtn, width: "auto", marginTop: 0, padding: "10px 12px", borderRadius: 12 }}
                  onClick={() => setSelectedId(null)}
                >
                  закрыть
                </button>
              </div>

              <div style={pillRow}>
                <span style={typeBadgeStyle(selectedItem.type)}>{TYPE_LABEL[selectedItem.type]}</span>
                <span style={sourceBadgeStyle(selectedItem.source)}>{SOURCE_LABEL[selectedItem.source]}</span>
              </div>

              <div style={{ marginTop: 10, opacity: 0.72, fontSize: 13, lineHeight: "18px" }}>
                этот айтем будет учтён в анализе. вайб мы будем считывать автоматически по контенту.
              </div>

              <button style={editBtn} onClick={() => startEdit(selectedItem.id)}>
                → редактировать
              </button>
              <button style={dangerBtn} onClick={() => removeItem(selectedItem.id)}>
                удалить
              </button>
            </div>
          )}

          {/* tiles */}
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {visibleLibrary.length === 0 ? (
              <div style={{ opacity: 0.72, lineHeight: "22px" }}>
                тут пока пусто. добавьте что-нибудь в add content или сделайте импорт.
              </div>
            ) : (
              visibleLibrary.map((it) => (
                <button
                  key={it.id}
                  style={{ ...tile, textAlign: "left", cursor: "pointer", outline: "none" }}
                  onClick={() => setSelectedId(it.id)}
                >
                  <div style={{ fontSize: 20, fontWeight: 950, marginBottom: 6, textTransform: "lowercase" }}>
                    {it.title}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 850, opacity: 0.78, textTransform: "lowercase" }}>
                    {it.authorOrArtist}
                  </div>

                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.65, textTransform: "lowercase" }}>
                    добавлено: {formatShortDate(it.createdAt)}
                  </div>

                  <div style={pillRow}>
                    <span style={typeBadgeStyle(it.type)}>{TYPE_LABEL[it.type]}</span>
                    <span style={sourceBadgeStyle(it.source)}>{SOURCE_LABEL[it.source]}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {/* analysis */}
      {tab === "analysis" && (
        <section style={card}>
          <h2 style={h2}>analysis</h2>

          <p style={helper}>
            выберите период и запустите вайбчек. дальше gpt будет считывать вайб по вашему контенту — без ручных тегов.
          </p>

          <div style={fieldLabel}>период</div>
          <select style={select} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="7d">последние 7 дней</option>
            <option value="30d">последние 30 дней</option>
            <option value="90d">последние 90 дней</option>
            <option value="all">за всё время</option>
          </select>

          <div style={{ marginTop: 12, opacity: 0.78, lineHeight: "22px", textTransform: "lowercase" }}>
            найдено айтемов в периоде: {analysisCounters.total} · музыка: {analysisCounters.byType.music} · книги:{" "}
            {analysisCounters.byType.book} · фильмы: {analysisCounters.byType.film}
          </div>

          <button
            style={analysisRunning ? disabledBtn : primaryBtn}
            onClick={runFakeAnalysis}
            disabled={analysisRunning}
          >
            {analysisRunning ? "думаем…" : "провести вайбчек"}
          </button>

          {analysisResult && (
            <div style={{ marginTop: 16, ...tile }}>
              <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 8, textTransform: "lowercase" }}>
                результат
              </div>
              <div style={{ opacity: 0.85, lineHeight: "22px", textTransform: "lowercase" }}>
                {analysisResult.summary}
              </div>

              <div style={{ marginTop: 12, opacity: 0.75, fontWeight: 900, textTransform: "lowercase" }}>
                что дальше
              </div>
              <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                {analysisResult.highlights.map((h) => (
                  <div key={h} style={{ opacity: 0.8, textTransform: "lowercase" }}>
                    • {h}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 10, opacity: 0.65, fontSize: 13, textTransform: "lowercase" }}>
                сохранено: {formatFullDate(analysisResult.createdAt)}
              </div>
            </div>
          )}

          {analysisHistory.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 8, textTransform: "lowercase" }}>
                история вайбчеков
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {analysisHistory.map((r) => (
                  <div key={r.id} style={{ ...tile, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 950, textTransform: "lowercase" }}>
                        {periodLabel(r.period).toLowerCase()} · {r.itemCount} айтемов
                      </div>
                      <button
                        style={{
                          border: "1px solid rgba(239,68,68,0.45)",
                          background: "rgba(239,68,68,0.10)",
                          borderRadius: 12,
                          padding: "8px 10px",
                          fontWeight: 950,
                          textTransform: "lowercase",
                        }}
                        onClick={() => deleteAnalysisRun(r.id)}
                      >
                        удалить
                      </button>
                    </div>

                    <div style={{ marginTop: 6, opacity: 0.8, lineHeight: "20px", textTransform: "lowercase" }}>
                      {r.summary}
                    </div>

                    <div style={{ marginTop: 8, opacity: 0.65, fontSize: 13, textTransform: "lowercase" }}>
                      {formatFullDate(r.createdAt)}
                    </div>

                    <button
                      style={{ ...secondaryBtn, marginTop: 10 }}
                      onClick={() => setAnalysisResult(r)}
                    >
                      открыть
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
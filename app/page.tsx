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

/**
 * ВАЖНО:
 * - createdAt мы НЕ показываем в UI, но сохраняем, если он уже есть,
 *   чтобы позже можно было включить периоды/таймлайны без потерь.
 * - это и есть "план на будущее" без риска слётов.
 */
type LibraryItem = {
  id: string;
  type: ContentType;
  source: SourceType;
  title: string;
  authorOrArtist: string;
  createdAt?: number;
};

type Tab = "home" | "add" | "library" | "analysis";

type AnalysisRun = {
  id: string;
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
  manual: "сами добавили",
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
    { title: "melancholia", authorOrArtist: "lars von etrier" },
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
    { title: "outline", authorOrArtist: "rachel cusk" },
    { title: "second place", authorOrArtist: "rachel cusk" },
    { title: "weather", authorOrArtist: "jenny offill" },
    { title: "котлован", authorOrArtist: "андрей платонов" },
    { title: "night", authorOrArtist: "elie wiesel" },
  ],
};

// ✅ ОДИН ключ навсегда
const STORAGE_KEY_LIBRARY = "everyyou.library";
// старые ключи, из которых мигрируем
const LEGACY_LIBRARY_KEYS = ["everyyou.library.v2", "everyyou.library.v3"];

const STORAGE_KEY_IMPORT = "everyyou.import"; // тоже без версий
const LEGACY_IMPORT_KEYS = ["everyyou.import.v2", "everyyou.import.v3"];

const STORAGE_KEY_ANALYSIS = "everyyou.analysis";
const LEGACY_ANALYSIS_KEYS = ["everyyou.analysis.v1", "everyyou.analysis.v2"];

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

/**
 * МИГРАЦИЯ: читаем данные из новых/старых ключей и приводим к актуальной форме.
 * - сохраняем createdAt, если он был
 * - нормализуем поля
 */
function loadAndMigrateLibrary(): LibraryItem[] {
  if (typeof window === "undefined") return [];

  // 1) пробуем новый ключ
  const main = safeParse<any[]>(window.localStorage.getItem(STORAGE_KEY_LIBRARY), []);
  if (Array.isArray(main) && main.length > 0) {
    return normalizeLibrary(main);
  }

  // 2) если пусто — пробуем старые ключи (берём первый непустой)
  for (const k of LEGACY_LIBRARY_KEYS) {
    const legacy = safeParse<any[]>(window.localStorage.getItem(k), []);
    if (Array.isArray(legacy) && legacy.length > 0) {
      const normalized = normalizeLibrary(legacy);
      // сохраняем уже в новый ключ, чтобы больше не терять
      window.localStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(normalized));
      return normalized;
    }
  }

  return [];
}

function normalizeLibrary(raw: any[]): LibraryItem[] {
  const out: LibraryItem[] = [];

  for (const x of raw) {
    if (!x) continue;

    // минимальная валидация
    const id = typeof x.id === "string" ? x.id : uid();

    const type: ContentType =
      x.type === "music" || x.type === "book" || x.type === "film" ? x.type : "music";

    const source: SourceType =
      x.source === "manual" || x.source === "import_spotify" ? x.source : "manual";

    const title = clampText(String(x.title ?? "")).toLowerCase();
    const authorOrArtist = clampText(String(x.authorOrArtist ?? "")).toLowerCase();

    if (!title || !authorOrArtist) continue;

    const createdAt =
      typeof x.createdAt === "number" && Number.isFinite(x.createdAt) ? x.createdAt : undefined;

    out.push({ id, type, source, title, authorOrArtist, createdAt });
  }

  return out;
}

function loadAndMigrateNumber(mainKey: string, legacyKeys: string[]): number {
  if (typeof window === "undefined") return 0;

  const mainRaw = window.localStorage.getItem(mainKey);
  if (mainRaw != null) {
    const n = Number(mainRaw);
    return Number.isFinite(n) ? n : 0;
  }

  for (const k of legacyKeys) {
    const raw = window.localStorage.getItem(k);
    if (raw == null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) {
      window.localStorage.setItem(mainKey, String(n));
      return n;
    }
  }

  return 0;
}

function loadAndMigrateAnalysis(): AnalysisRun[] {
  if (typeof window === "undefined") return [];
  const main = safeParse<AnalysisRun[]>(window.localStorage.getItem(STORAGE_KEY_ANALYSIS), []);
  if (Array.isArray(main) && main.length > 0) return main;

  for (const k of LEGACY_ANALYSIS_KEYS) {
    const legacy = safeParse<AnalysisRun[]>(window.localStorage.getItem(k), []);
    if (Array.isArray(legacy) && legacy.length > 0) {
      window.localStorage.setItem(STORAGE_KEY_ANALYSIS, JSON.stringify(legacy));
      return legacy;
    }
  }
  return [];
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
  const [importedCount, setImportedCount] = useState<number>(0);

  // analysis
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

  // ✅ загрузка + миграции на старте
  useEffect(() => {
    if (typeof window === "undefined") return;

    const migratedLibrary = loadAndMigrateLibrary();
    setLibrary(migratedLibrary);

    const migratedImportedCount = loadAndMigrateNumber(STORAGE_KEY_IMPORT, LEGACY_IMPORT_KEYS);
    setImportedCount(migratedImportedCount);

    const migratedAnalysis = loadAndMigrateAnalysis();
    setAnalysisHistory(migratedAnalysis);
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

  const counters = useMemo(() => {
    const byType: Record<ContentType, number> = { music: 0, book: 0, film: 0 };
    for (const it of library) byType[it.type] += 1;
    return { byType, total: library.length };
  }, [library]);

  function resetForm() {
    setType("");
    setSource("");
    setTitle("");
    setAuthorOrArtist("");
  }

  function addItem() {
    if (!canSave) return;

    const item: LibraryItem = {
      id: uid(),
      type: type as ContentType,
      source: source as SourceType,
      title: clampText(title).toLowerCase(),
      authorOrArtist: clampText(authorOrArtist).toLowerCase(),
      // createdAt сохраняем, но UI не показывает
      createdAt: Date.now(),
    };

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
          // createdAt сохраняем как было
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

    const fake: LibraryItem[] = [
      {
        id: uid(),
        type: "music",
        source: "import_spotify",
        title: "about today",
        authorOrArtist: "the national",
        createdAt: Date.now(),
      },
      {
        id: uid(),
        type: "music",
        source: "import_spotify",
        title: "codex",
        authorOrArtist: "radiohead",
        createdAt: Date.now(),
      },
    ];

    setLibrary((prev) => [...fake, ...prev]);
    setIsImporting(false);
    setTab("library");
  }

  async function runFakeAnalysis() {
    if (analysisRunning) return;
    setAnalysisRunning(true);

    await new Promise((r) => setTimeout(r, 900));

    const total = counters.total;
    const t = counters.byType;

    const summary =
      total === 0
        ? "пока пусто. добавьте пару айтемов — и сделаем вид, что мы что-то поняли."
        : `окей, я посмотрел(а) на всё, что у вас есть. всего: ${total} · музыка: ${t.music} · книги: ${t.book} · фильмы: ${t.film}.`;

    const highlights =
      total === 0
        ? ["можно начать с импорта spotify", "или добавить что-то сами"]
        : [
            "это пока демо: вайбчек делает вид, что он умный",
            "следующий шаг — подключить spotify, а потом и остальное",
            "и да, можно не относиться к вайбчеку серьёзно. он тут скорее для красоты",
          ];

    const result: AnalysisRun = {
      id: uid(),
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
  const h2: React.CSSProperties = {
    margin: "0 0 10px 0",
    fontSize: 22,
    fontWeight: 950,
    textTransform: "lowercase",
  };

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

  const pillRow: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  };

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
        <button style={tabBtn(tab === "home")} onClick={() => setTab("home")}>
          home
        </button>
        <button style={tabBtn(tab === "add")} onClick={() => setTab("add")}>
          add content
        </button>
        <button style={tabBtn(tab === "library")} onClick={() => setTab("library")}>
          library
        </button>
        <button style={tabBtn(tab === "analysis")} onClick={() => setTab("analysis")}>
          analysis
        </button>
      </div>

      {tab === "home" && (
        <section style={card}>
          <h2 style={h2}>что это</h2>
          <p style={helper}>
            тут вы собираете всё, что смотрите, читаете и слушаете, в одном месте. чтобы видеть полную
            картину, а не жить в десяти приложениях одновременно.
          </p>
          <p style={{ ...helper, marginTop: -2 }}>
            если захотите — можно нажать вайбчек. но не относитесь к нему серьёзно, он тут скорее как маленькая шутка.
          </p>

          <button style={primaryBtn} onClick={() => setTab("add")}>
            → добавить контент
          </button>
          <button style={secondaryBtn} onClick={() => setTab("library")}>
            → открыть библиотеку
          </button>
          <button style={secondaryBtn} onClick={() => setTab("analysis")}>
            → вайбчек
          </button>

          <div style={{ marginTop: 14, opacity: 0.65, fontSize: 13, lineHeight: "18px" }}>
            telegram webapp: {hasTg ? "detected" : "not detected"} · ready: {ready ? "yes" : "no"}
          </div>
        </section>
      )}

      {tab === "add" && (
        <section style={card}>
          <h2 style={h2}>{editingId ? "редактировать" : "add content"}</h2>

          <p style={{ ...helper, marginBottom: 8 }}>
            импорт — чтобы быстро накидать музыки. сами добавили — чтобы внести вообще что угодно.
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
              <option value="manual">сами добавили</option>
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
            <option value="manual">сами добавили</option>
            <option value="import_spotify">импорт</option>
          </select>

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

              <button style={editBtn} onClick={() => startEdit(selectedItem.id)}>
                → редактировать
              </button>
              <button style={dangerBtn} onClick={() => removeItem(selectedItem.id)}>
                удалить
              </button>
            </div>
          )}

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

      {tab === "analysis" && (
        <section style={card}>
          <h2 style={h2}>analysis</h2>

          <p style={helper}>
            тут можно сделать вайбчек по всей библиотеке. он пока демо и слегка шутка, но кнопка настоящая.
          </p>

          <div style={{ marginTop: 12, opacity: 0.78, lineHeight: "22px", textTransform: "lowercase" }}>
            всего айтемов: {counters.total} · музыка: {counters.byType.music} · книги: {counters.byType.book} · фильмы:{" "}
            {counters.byType.film}
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
                заметки
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
                      <div style={{ fontWeight: 950, textTransform: "lowercase" }}>{r.itemCount} айтемов</div>
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

                    <button style={{ ...secondaryBtn, marginTop: 10 }} onClick={() => setAnalysisResult(r)}>
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
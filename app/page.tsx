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

type VibeTag =
  | "всё бесит"
  | "тупо"
  | "круто"
  | "не круто"
  | "нужно для дела"
  | "хочу вдохновиться"
  | "подумать/переварить"
  | "хз если честно";

type LibraryItem = {
  id: string;
  type: ContentType;
  source: SourceType;
  title: string;
  authorOrArtist: string;
  vibe?: VibeTag;
  createdAt: number; // ms
};

type Tab = "home" | "add" | "library" | "analysis";
type Period = "7d" | "30d" | "90d" | "all";

const VIBES: VibeTag[] = [
  "всё бесит",
  "тупо",
  "круто",
  "не круто",
  "нужно для дела",
  "хочу вдохновиться",
  "подумать/переварить",
  "хз если честно",
];

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
    { title: "call me by your name", authorOrArtist: "luca guadagnino" },
    { title: "eternal sunshine", authorOrArtist: "michel gondry" },
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

const STORAGE_KEY_LIBRARY = "everyyou.library.v1";
const STORAGE_KEY_IMPORT = "everyyou.import.v1";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampText(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function formatShortDate(ms: number) {
  const d = new Date(ms);
  return d
    .toLocaleDateString(undefined, { day: "2-digit", month: "short" })
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
    music: { background: "rgba(99,102,241,0.16)", borderColor: "rgba(99,102,241,0.35)" }, // индиго/синий
    book: { background: "rgba(168,85,247,0.16)", borderColor: "rgba(168,85,247,0.35)" }, // фиолетовый
    film: { background: "rgba(236,72,153,0.14)", borderColor: "rgba(236,72,153,0.32)" }, // розовый
  };
  return { ...baseBadge(), ...map[type] };
}

function sourceBadgeStyle(source: SourceType): React.CSSProperties {
  const map: Record<SourceType, React.CSSProperties> = {
    manual: { background: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.30)" }, // зелёный
    import_spotify: { background: "rgba(59,130,246,0.14)", borderColor: "rgba(59,130,246,0.30)" }, // голубой/синий
  };
  return { ...baseBadge(), ...map[source] };
}

function vibeBadgeStyle(vibe?: VibeTag): React.CSSProperties {
  const map: Partial<Record<VibeTag, React.CSSProperties>> = {
    "круто": { background: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.30)" }, // зелёный
    "не круто": { background: "rgba(249,115,22,0.14)", borderColor: "rgba(249,115,22,0.30)" }, // оранжевый
    "всё бесит": { background: "rgba(239,68,68,0.14)", borderColor: "rgba(239,68,68,0.30)" }, // красный
    "тупо": { background: "rgba(168,85,247,0.14)", borderColor: "rgba(168,85,247,0.30)" }, // фиолетовый
    "нужно для дела": { background: "rgba(59,130,246,0.14)", borderColor: "rgba(59,130,246,0.30)" }, // синий
    "хочу вдохновиться": { background: "rgba(236,72,153,0.14)", borderColor: "rgba(236,72,153,0.30)" }, // розовый
    "подумать/переварить": { background: "rgba(139,92,246,0.14)", borderColor: "rgba(139,92,246,0.30)" }, // сиреневый
    "хз если честно": { background: "rgba(14,165,233,0.14)", borderColor: "rgba(14,165,233,0.30)" }, // голубой
  };

  if (!vibe) {
    return { ...baseBadge(), background: "rgba(0,0,0,0.05)" };
  }
  return { ...baseBadge(), ...(map[vibe] ?? { background: "rgba(0,0,0,0.05)" }) };
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
  const [vibe, setVibe] = useState<VibeTag | "">("");

  // placeholder rotation
  const [phIdx, setPhIdx] = useState(0);

  // library
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libraryVibeFilter, setLibraryVibeFilter] = useState<VibeTag | "all">("all");
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
    const raw = window.localStorage.getItem(STORAGE_KEY_LIBRARY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as LibraryItem[];
      if (Array.isArray(parsed)) setLibrary(parsed);
    } catch {
      // ignore
    }
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
    // ротируем плейсхолдеры постоянно, чтобы не застаивались
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

  const canAdd = useMemo(() => {
    return Boolean(type && source && clampText(title) && clampText(authorOrArtist));
  }, [type, source, title, authorOrArtist]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return library.find((x) => x.id === selectedId) ?? null;
  }, [selectedId, library]);

  const visibleLibrary = useMemo(() => {
    if (libraryVibeFilter === "all") return library;
    if (libraryVibeFilter === ("" as any)) return library.filter((x) => !x.vibe);
    return library.filter((x) => x.vibe === libraryVibeFilter);
  }, [library, libraryVibeFilter]);

  const analysisRange = useMemo(() => {
    const now = Date.now();
    if (period === "all") return { from: 0, to: now };
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    return { from: now - days * 24 * 60 * 60 * 1000, to: now };
  }, [period]);

  const analysisItems = useMemo(() => {
    return library.filter((x) => x.createdAt >= analysisRange.from && x.createdAt <= analysisRange.to);
  }, [library, analysisRange]);

  const analysisStats = useMemo(() => {
    const byType: Record<ContentType, number> = { music: 0, book: 0, film: 0 };
    const byVibe: Record<string, number> = {};
    for (const it of analysisItems) {
      byType[it.type] += 1;
      const key = it.vibe ?? "без вайба";
      byVibe[key] = (byVibe[key] ?? 0) + 1;
    }

    const vibesSorted = Object.entries(byVibe).sort((a, b) => b[1] - a[1]);
    const topVibes = vibesSorted.slice(0, 4);

    return { byType, topVibes, total: analysisItems.length };
  }, [analysisItems]);

  function resetForm() {
    setType("");
    setSource("");
    setTitle("");
    setAuthorOrArtist("");
    setVibe("");
  }

  function addToLibrary() {
    if (!canAdd) return;
    const item: LibraryItem = {
      id: uid(),
      type: type as ContentType,
      source: source as SourceType,
      title: clampText(title).toLowerCase(),
      authorOrArtist: clampText(authorOrArtist).toLowerCase(),
      vibe: vibe ? (vibe as VibeTag) : undefined,
      createdAt: Date.now(),
    };
    setLibrary((prev) => [item, ...prev]);
    resetForm();
    setTab("library");
  }

  function removeItem(id: string) {
    setLibrary((prev) => prev.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
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
    setVibe(it.vibe ?? "");
  }

  function saveEdit() {
    if (!editingId) return;
    if (!canAdd) return;

    setLibrary((prev) =>
      prev.map((x) => {
        if (x.id !== editingId) return x;
        return {
          ...x,
          type: type as ContentType,
          source: source as SourceType,
          title: clampText(title).toLowerCase(),
          authorOrArtist: clampText(authorOrArtist).toLowerCase(),
          vibe: vibe ? (vibe as VibeTag) : undefined,
        };
      })
    );

    const id = editingId;
    setEditingId(null);
    resetForm();
    setTab("library");
    setSelectedId(id);
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
        vibe: "подумать/переварить",
        createdAt: now,
      },
      {
        id: uid(),
        type: "music",
        source: "import_spotify",
        title: "codex",
        authorOrArtist: "radiohead",
        vibe: "хз если честно",
        createdAt: now - 60_000,
      },
    ];

    setLibrary((prev) => [...fake, ...prev]);

    setIsImporting(false);
    setTab("library");
  }

  const pageWrap: React.CSSProperties = {
    padding: 24,
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  };

  const h1: React.CSSProperties = { margin: "0 0 8px 0", fontSize: 28, fontWeight: 900 };
  const h2: React.CSSProperties = {
    margin: "0 0 10px 0",
    fontSize: 22,
    fontWeight: 900,
    textTransform: "lowercase",
  };

  const helper: React.CSSProperties = { margin: "0 0 10px 0", opacity: 0.8, lineHeight: "22px" };

  const tabs: React.CSSProperties = {
    display: "flex",
    gap: 10,
    margin: "12px 0 16px 0",
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: active ? "black" : "white",
    color: active ? "white" : "black",
    fontWeight: 800,
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
    fontWeight: 900,
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

  const select: React.CSSProperties = {
    ...input,
    appearance: "none",
    background: "white",
  };

  const primaryBtn: React.CSSProperties = {
    width: "100%",
    marginTop: 16,
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "black",
    color: "white",
    fontSize: 16,
    fontWeight: 900,
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
    fontWeight: 900,
    textTransform: "lowercase",
  };

  const disabledBtn: React.CSSProperties = {
    ...primaryBtn,
    background: "rgba(0,0,0,0.18)",
    color: "rgba(0,0,0,0.55)",
  };

  const dangerBtn: React.CSSProperties = {
    ...secondaryBtn,
    borderColor: "rgba(239,68,68,0.45)",
    background: "rgba(239,68,68,0.10)",
  };

  const editBtn: React.CSSProperties = {
    ...secondaryBtn,
    borderColor: "rgba(59,130,246,0.45)",
    background: "rgba(59,130,246,0.10)",
  };

  const tile: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 18,
    padding: 16,
    background: "white",
  };

  const chipsRow: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
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

      {/* HOME */}
      {tab === "home" && (
        <section style={card}>
          <h2 style={h2}>что это</h2>
          <p style={helper}>
            everyyou собирает всё, что вы смотрите, читаете и слушаете — чтобы вы видели, как контент
            влияет на настроение и состояние. дальше можно собрать библиотеку и в любой момент сделать
            вайбчек по выбранному периоду.
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

      {/* ADD CONTENT */}
      {tab === "add" && (
        <section style={card}>
          <h2 style={h2}>{editingId ? "редактировать" : "add content"}</h2>

          {/* импорт */}
          <p style={{ ...helper, marginBottom: 8 }}>
            импорт — чтобы быстро накидать контента и не страдать.
          </p>
          <button
            style={isImporting ? disabledBtn : secondaryBtn}
            onClick={runFakeImport}
            disabled={isImporting}
          >
            {isImporting ? "тянем данные…" : "импорт"}
          </button>
          <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13, textTransform: "lowercase" }}>
            импортировано: {importedCount} треков
          </div>

          {/* вручную */}
          <div style={{ marginTop: 16 }}>
            <p style={{ ...helper, marginBottom: 6 }}>
              вручную — добавляйте что хотите: музыку, книги, фильмы. хоть «стыдный ромком», хоть «тяжёлая правда жизни».
            </p>

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

            <div style={fieldLabel}>тэги/вайбы</div>
            <select style={select} value={vibe} onChange={(e) => setVibe(e.target.value as any)}>
              <option value="">ничего</option>
              {VIBES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13, textTransform: "lowercase" }}>
              сейчас выбрано: {vibe ? vibe : "ничего"}, это поле можно оставить пустым
            </div>

            {!editingId ? (
              <button style={canAdd ? primaryBtn : disabledBtn} onClick={addToLibrary} disabled={!canAdd}>
                → добавить в библиотеку
              </button>
            ) : (
              <>
                <button style={canAdd ? primaryBtn : disabledBtn} onClick={saveEdit} disabled={!canAdd}>
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

      {/* LIBRARY */}
      {tab === "library" && (
        <section style={card}>
          <h2 style={h2}>library</h2>

          <div style={fieldLabel}>фильтр по тэги/вайбы</div>
          <select
            style={select}
            value={libraryVibeFilter === "all" ? "all" : libraryVibeFilter}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "all") setLibraryVibeFilter("all");
              else if (val === "") setLibraryVibeFilter("" as any);
              else setLibraryVibeFilter(val as VibeTag);
              setSelectedId(null);
            }}
          >
            <option value="all">все</option>
            <option value="">без вайба</option>
            {VIBES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          {/* детальная карточка */}
          {selectedItem && (
            <div style={{ marginTop: 16, ...tile }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 950, marginBottom: 6, textTransform: "lowercase" }}>
                    {selectedItem.title}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, opacity: 0.75, textTransform: "lowercase" }}>
                    {selectedItem.authorOrArtist}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.65, textTransform: "lowercase" }}>
                    добавлено: {formatShortDate(selectedItem.createdAt)}
                  </div>
                </div>

                <button
                  style={{ ...secondaryBtn, width: "auto", marginTop: 0, padding: "10px 12px", borderRadius: 12 }}
                  onClick={() => setSelectedId(null)}
                >
                  закрыть
                </button>
              </div>

              <div style={chipsRow}>
                <span style={typeBadgeStyle(selectedItem.type)}>{TYPE_LABEL[selectedItem.type]}</span>
                <span style={sourceBadgeStyle(selectedItem.source)}>{SOURCE_LABEL[selectedItem.source]}</span>
                {selectedItem.vibe ? (
                  <span style={vibeBadgeStyle(selectedItem.vibe)}>{selectedItem.vibe}</span>
                ) : (
                  <span style={vibeBadgeStyle(undefined)}>без вайба</span>
                )}
              </div>

              <button style={editBtn} onClick={() => startEdit(selectedItem.id)}>
                → редактировать
              </button>
              <button style={dangerBtn} onClick={() => removeItem(selectedItem.id)}>
                удалить
              </button>
            </div>
          )}

          {/* плитки */}
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {visibleLibrary.length === 0 ? (
              <div style={{ opacity: 0.7, lineHeight: "22px" }}>
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
                  <div style={{ fontSize: 16, fontWeight: 800, opacity: 0.75, textTransform: "lowercase" }}>
                    {it.authorOrArtist}
                  </div>

                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.65, textTransform: "lowercase" }}>
                    добавлено: {formatShortDate(it.createdAt)}
                  </div>

                  <div style={chipsRow}>
                    <span style={typeBadgeStyle(it.type)}>{TYPE_LABEL[it.type]}</span>
                    <span style={sourceBadgeStyle(it.source)}>{SOURCE_LABEL[it.source]}</span>
                    {it.vibe ? (
                      <span style={vibeBadgeStyle(it.vibe)}>{it.vibe}</span>
                    ) : (
                      <span style={vibeBadgeStyle(undefined)}>без вайба</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {/* ANALYSIS */}
      {tab === "analysis" && (
        <section style={card}>
          <h2 style={h2}>analysis</h2>

          <div style={fieldLabel}>период</div>
          <select style={select} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="7d">последние 7 дней</option>
            <option value="30d">последние 30 дней</option>
            <option value="90d">последние 90 дней</option>
            <option value="all">за всё время</option>
          </select>

          <div style={{ marginTop: 16, ...tile }}>
            <div style={{ fontSize: 20, fontWeight: 950, marginBottom: 6, textTransform: "lowercase" }}>
              вайбчек
            </div>

            <div style={{ opacity: 0.8, lineHeight: "22px", textTransform: "lowercase" }}>
              всего: {analysisStats.total} · музыка: {analysisStats.byType.music} · книги: {analysisStats.byType.book} · фильмы:{" "}
              {analysisStats.byType.film}
            </div>

            <div style={{ marginTop: 12, opacity: 0.75, textTransform: "lowercase" }}>топ вайбы:</div>
            <div style={{ ...chipsRow, marginTop: 10 }}>
              {analysisStats.topVibes.length === 0 ? (
                <span style={vibeBadgeStyle(undefined)}>пока нечего анализировать</span>
              ) : (
                analysisStats.topVibes.map(([k, v]) => (
                  <span key={k} style={k === "без вайба" ? vibeBadgeStyle(undefined) : vibeBadgeStyle(k as VibeTag)}>
                    {k} · {v}
                  </span>
                ))
              )}
            </div>

            <button style={secondaryBtn} onClick={() => setTab("library")}>
              → открыть библиотеку
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
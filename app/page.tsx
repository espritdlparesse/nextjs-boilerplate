"use client";

import { useEffect, useMemo, useState } from "react";

type ItemType = "music" | "book" | "movie";
type SourceType = "spotify" | "goodreads" | "letterboxd" | "manual";

type LibraryItem = {
  id: string;
  createdAt: number;
  type: ItemType;
  source: SourceType;
  title: string;
  creator: string; // artist / author / director
  vibe?: string; // optional
};

type TgUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

const STORAGE_KEY = "everyyou.library.v1";

// вайбы — потом можно легко переименовать/добавить
const VIBES: Array<{ value: string; label: string }> = [
  { value: "vibe.cool", label: "круто" },
  { value: "vibe.not_cool", label: "не круто" },
  { value: "vibe.annoyed", label: "всё бесит" },
  { value: "vibe.dumb", label: "тупо" },
  { value: "vibe.for_work", label: "нужно для дела" },
  { value: "vibe.inspire", label: "хочу вдохновиться" },
  { value: "vibe.digest", label: "подумать/переварить" },
  { value: "vibe.idk", label: "хз если честно" },
];

const TYPE_LABEL: Record<ItemType, string> = {
  music: "музыка",
  book: "книга",
  movie: "фильм",
};

const SOURCE_LABEL: Record<SourceType, string> = {
  spotify: "spotify",
  goodreads: "goodreads",
  letterboxd: "letterboxd",
  manual: "вручную",
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export default function Home() {
  const [tab, setTab] = useState<"home" | "add" | "library" | "analysis">("home");

  const [hasTg, setHasTg] = useState(false);
  const [user, setUser] = useState<TgUser | null>(null);

  const [items, setItems] = useState<LibraryItem[]>([]);

  // форма добавления
  const [type, setType] = useState<ItemType>("music");
  const [source, setSource] = useState<SourceType>("manual");
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [vibe, setVibe] = useState<string>(""); // пусто = ок

  // фильтр библиотеки
  const [vibeFilter, setVibeFilter] = useState<string>("");

  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg) {
      setHasTg(false);
      setUser(null);
      return;
    }
    setHasTg(true);
    tg.ready();
    setUser(tg.initDataUnsafe?.user ?? null);
  }, []);

  useEffect(() => {
    const saved = safeJsonParse<LibraryItem[]>(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved)) {
      setItems(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const displayName = useMemo(() => {
    const first = user?.first_name?.trim();
    if (!first) return "привет 👋";
    return `привет, ${first.toLowerCase()} 👋`;
  }, [user]);

  const appIntro = `everyyou собирает весь контент, который вы потребляете — музыка, книги, фильмы — в одном месте. потом помогает заметить, как он влияет на ваше состояние, и делать свой личный “вайбчек” когда захочется.`;

  const vibeLabel = (v?: string) => {
    if (!v) return "";
    const found = VIBES.find((x) => x.value === v);
    return found?.label ?? v;
  };

  const filteredItems = useMemo(() => {
    if (!vibeFilter) return items;
    if (vibeFilter === "__none__") return items.filter((x) => !x.vibe);
    return items.filter((x) => x.vibe === vibeFilter);
  }, [items, vibeFilter]);

  const addItem = () => {
    const t = title.trim();
    const c = creator.trim();
    if (!t || !c) return;

    const next: LibraryItem = {
      id: uid(),
      createdAt: Date.now(),
      type,
      source,
      title: t,
      creator: c,
      vibe: vibe ? vibe : undefined,
    };

    setItems((prev) => [next, ...prev]);

    // сброс формы, но вайб оставим пустым по умолчанию
    setTitle("");
    setCreator("");
    setVibe("");
    setTab("library");
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  // analysis: вайбчек + типы
  const vibeStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const k = it.vibe ?? "__none__";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const typeStats = useMemo(() => {
    const map = new Map<ItemType, number>();
    for (const it of items) map.set(it.type, (map.get(it.type) ?? 0) + 1);
    return (["music", "book", "movie"] as ItemType[]).map((t) => ({
      type: t,
      count: map.get(t) ?? 0,
    }));
  }, [items]);

  const Card = ({
    children,
    style,
  }: {
    children: React.ReactNode;
    style?: React.CSSProperties;
  }) => (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 14,
        padding: 14,
        background: "white",
        ...style,
      }}
    >
      {children}
    </div>
  );

  const PillNav = () => (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
      <button
        onClick={() => setTab("home")}
        style={pillStyle(tab === "home")}
      >
        home
      </button>
      <button
        onClick={() => setTab("add")}
        style={pillStyle(tab === "add")}
      >
        add content
      </button>
      <button
        onClick={() => setTab("library")}
        style={pillStyle(tab === "library")}
      >
        library
      </button>
      <button
        onClick={() => setTab("analysis")}
        style={pillStyle(tab === "analysis")}
      >
        analysis
      </button>
    </div>
  );

  return (
    <main style={{ padding: 22, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>EveryYou</h1>

      {/* приветствие */}
      <div style={{ opacity: 0.9 }}>
        <div>{displayName}</div>
        {!hasTg && (
          <div style={{ marginTop: 6, opacity: 0.7 }}>
            telegram webapp не найден — откройте мини-приложение внутри telegram
          </div>
        )}
      </div>

      <PillNav />

      {/* home */}
      {tab === "home" && (
        <div style={{ marginTop: 16 }}>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              что это вообще такое
            </div>
            <div style={{ opacity: 0.85, lineHeight: 1.45 }}>{appIntro}</div>
          </Card>

          <div style={{ height: 12 }} />

          {items.length === 0 ? (
            <Card>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                библиотека пока пустая
              </div>
              <div style={{ opacity: 0.85, lineHeight: 1.45 }}>
                начнём с простого: добавьте первый айтем вручную — потом подключим
                spotify / goodreads / letterboxd.
              </div>

              <button
                onClick={() => setTab("add")}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "black",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                → добавить первый айтем
              </button>
            </Card>
          ) : (
            <Card>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                что делаем дальше
              </div>
              <div style={{ opacity: 0.85, lineHeight: 1.45 }}>
                добавляем контент → собираем библиотеку → жмём “analysis” когда
                хочется.
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <button
                  onClick={() => setTab("add")}
                  style={primaryBtnStyle()}
                >
                  → add content
                </button>
                <button
                  onClick={() => setTab("library")}
                  style={secondaryBtnStyle()}
                >
                  → library
                </button>
                <button
                  onClick={() => setTab("analysis")}
                  style={secondaryBtnStyle()}
                >
                  → analysis
                </button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* add content */}
      {tab === "add" && (
        <div style={{ marginTop: 16 }}>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>add content</div>
            <div style={{ opacity: 0.85, lineHeight: 1.45 }}>
              пока тут ручное добавление. дальше подключим spotify / goodreads /
              letterboxd.
            </div>

            <div style={{ height: 14 }} />

            <label style={labelStyle}>тип</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ItemType)}
              style={selectStyle}
            >
              <option value="music">музыка</option>
              <option value="book">книга</option>
              <option value="movie">фильм</option>
            </select>

            <div style={{ height: 10 }} />

            <label style={labelStyle}>источник</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as SourceType)}
              style={selectStyle}
            >
              <option value="manual">вручную</option>
              <option value="spotify">spotify</option>
              <option value="goodreads">goodreads</option>
              <option value="letterboxd">letterboxd</option>
            </select>

            <div style={{ height: 10 }} />

            <label style={labelStyle}>название</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="например: the national — about today"
              style={inputStyle}
            />

            <div style={{ height: 10 }} />

            <label style={labelStyle}>автор / исполнитель</label>
            <input
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              placeholder="например: the national"
              style={inputStyle}
            />

            <div style={{ height: 10 }} />

            <label style={labelStyle}>тэги/вайбы</label>
            <select
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              style={selectStyle}
            >
              <option value="">—</option>
              {VIBES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>

            <div style={{ marginTop: 8, opacity: 0.7 }}>
              сейчас выбрано: {vibe ? vibeLabel(vibe) : "ничего"}, это поле можно
              оставить пустым
            </div>

            <button
              onClick={addItem}
              disabled={!title.trim() || !creator.trim()}
              style={{
                marginTop: 14,
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.12)",
                background:
                  !title.trim() || !creator.trim() ? "rgba(0,0,0,0.2)" : "black",
                color: "white",
                fontWeight: 600,
              }}
            >
              → добавить в библиотеку
            </button>
          </Card>
        </div>
      )}

      {/* library */}
      {tab === "library" && (
        <div style={{ marginTop: 16 }}>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>library</div>

            <label style={labelStyle}>фильтр по тэги/вайбы</label>
            <select
              value={vibeFilter}
              onChange={(e) => setVibeFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">все</option>
              <option value="__none__">без вайба</option>
              {VIBES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>

            <div style={{ height: 14 }} />

            {filteredItems.length === 0 ? (
              <div style={{ opacity: 0.8, lineHeight: 1.45 }}>
                тут пока пусто. идём в add content и добавляем что-нибудь.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                  marginTop: 6,
                }}
              >
                {filteredItems.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 16,
                      padding: 14,
                      background: "white",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      {it.title}
                    </div>
                    <div style={{ opacity: 0.85, marginBottom: 8 }}>
                      {it.creator}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Tag text={TYPE_LABEL[it.type]} />
                      <Tag text={SOURCE_LABEL[it.source]} />
                      {it.vibe ? <Tag text={vibeLabel(it.vibe)} /> : <Tag text="без вайба" />}
                    </div>

                    <button
                      onClick={() => removeItem(it.id)}
                      style={{
                        marginTop: 10,
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: "1px solid rgba(0,0,0,0.12)",
                        background: "white",
                        fontWeight: 600,
                      }}
                    >
                      удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* analysis */}
      {tab === "analysis" && (
        <div style={{ marginTop: 16 }}>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>analysis</div>

            {items.length === 0 ? (
              <div style={{ opacity: 0.8, lineHeight: 1.45 }}>
                сначала добавьте контент — тогда появится вайбчек.
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>вайбчек</div>

                <div style={{ display: "grid", gap: 8 }}>
                  {vibeStats.map(([k, n]) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: "white",
                      }}
                    >
                      <div style={{ opacity: 0.9 }}>
                        {k === "__none__" ? "без вайба" : vibeLabel(k)}
                      </div>
                      <div style={{ fontWeight: 700 }}>{n}</div>
                    </div>
                  ))}
                </div>

                <div style={{ height: 14 }} />

                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  разрез по типам
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {typeStats.map((x) => (
                    <div
                      key={x.type}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: "white",
                      }}
                    >
                      <div style={{ opacity: 0.9 }}>{TYPE_LABEL[x.type]}</div>
                      <div style={{ fontWeight: 700 }}>{x.count}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: active ? "black" : "white",
    color: active ? "white" : "black",
    fontWeight: 600,
  };
}

function primaryBtnStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "black",
    color: "white",
    fontWeight: 600,
  };
}

function secondaryBtnStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontWeight: 600,
  };
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  opacity: 0.75,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.12)",
  outline: "none",
  fontSize: 16,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "white",
  fontSize: 16,
};

function Tag({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.12)",
        fontSize: 13,
        opacity: 0.9,
      }}
    >
      {text}
    </span>
  );
}
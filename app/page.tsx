"use client";

import { useEffect, useMemo, useState } from "react";

type TgUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type Screen = "home" | "add" | "library" | "analysis";

type ItemType = "book" | "movie" | "music";
type Source = "Spotify" | "Goodreads" | "Letterboxd" | "Manual";

type Vibe =
  | "Грустно"
  | "Всё бесит"
  | "Тупо"
  | "Круто"
  | "Не круто"
  | "Нужно для дела"
  | "Хочу вдохновиться"
  | "Успокоиться"
  | "Подумать/переварить"
  | "Фоновое";

type Period = "7" | "30" | "all";

type Item = {
  id: string;
  type: ItemType;
  title: string;
  source: Source;
  vibe: Vibe;
  createdAt: number;
};

const STORAGE_KEY = "everyyou_items_v2"; // v2 чтобы не конфликтовать со старой схемой
const VIBES: Vibe[] = [
  "Грустно",
  "Всё бесит",
  "Тупо",
  "Круто",
  "Не круто",
  "Нужно для дела",
  "Хочу вдохновиться",
  "Успокоиться",
  "Подумать/переварить",
  "Фоновое",
];

function safeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function typeLabel(t: ItemType) {
  if (t === "book") return "Книга";
  if (t === "movie") return "Фильм";
  return "Музыка";
}

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

function periodCutoff(period: Period) {
  const now = Date.now();
  if (period === "7") return now - 7 * 24 * 60 * 60 * 1000;
  if (period === "30") return now - 30 * 24 * 60 * 60 * 1000;
  return 0;
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [hasTg, setHasTg] = useState(false);
  const [user, setUser] = useState<TgUser | null>(null);

  const [screen, setScreen] = useState<Screen>("home");
  const [items, setItems] = useState<Item[]>([]);

  // Add content (draft)
  const [draftType, setDraftType] = useState<ItemType>("book");
  const [draftSource, setDraftSource] = useState<Source>("Manual");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftVibe, setDraftVibe] = useState<Vibe>("Круто");
  const [error, setError] = useState<string | null>(null);

  // Analysis
  const [period, setPeriod] = useState<Period>("30");

  // Telegram init
  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;

    if (!tg) {
      setHasTg(false);
      return;
    }

    setHasTg(true);

    tg.ready();
    tg.expand();

    try {
      tg.setHeaderColor?.("#ffffff");
      tg.setBackgroundColor?.("#ffffff");
    } catch {}

    setUser(tg.initDataUnsafe?.user ?? null);
    setReady(true);
  }, []);

  // load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Item[];
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {
      // ignore
    }
  }, []);

  // save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  const name = user?.first_name ?? "друг";

  const header = useMemo(() => {
    switch (screen) {
      case "home":
        return { title: "EveryYou", subtitle: `Привет, ${name} 👋` };
      case "add":
        return { title: "Add content", subtitle: "Вручную — но по-человечески" };
      case "library":
        return { title: "Library", subtitle: "Ваш список контента" };
      case "analysis":
        return { title: "Analysis", subtitle: "Период + срез по вибам" };
    }
  }, [screen, name]);

  const filtered = useMemo(() => {
    const cutoff = periodCutoff(period);
    return items.filter((i) => i.createdAt >= cutoff);
  }, [items, period]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const books = filtered.filter((i) => i.type === "book").length;
    const movies = filtered.filter((i) => i.type === "movie").length;
    const music = filtered.filter((i) => i.type === "music").length;

    const byVibe = new Map<Vibe, number>();
    for (const i of filtered) {
      byVibe.set(i.vibe, (byVibe.get(i.vibe) ?? 0) + 1);
    }
    const vibeTop = Array.from(byVibe.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const latest = [...filtered].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);

    return { total, books, movies, music, vibeTop, latest };
  }, [filtered]);

  const Button = ({
    children,
    onClick,
    variant = "primary",
    disabled = false,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    variant?: "primary" | "ghost" | "danger";
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "14px 14px",
        borderRadius: 12,
        border:
          variant === "ghost"
            ? "1px solid #e5e5e5"
            : variant === "danger"
            ? "1px solid #b42318"
            : "1px solid #111",
        background:
          variant === "ghost" ? "#fff" : variant === "danger" ? "#b42318" : "#111",
        color: variant === "ghost" ? "#111" : "#fff",
        fontSize: 16,
        fontWeight: 800,
        textAlign: "left",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );

  const Chip = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid #e5e5e5",
        background: active ? "#111" : "#fff",
        color: active ? "#fff" : "#111",
        fontSize: 14,
        fontWeight: 800,
      }}
    >
      {label}
    </button>
  );

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div
      style={{
        marginTop: 14,
        padding: 16,
        borderRadius: 14,
        background: "#f5f5f5",
      }}
    >
      {children}
    </div>
  );

  const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6, opacity: 0.75 }}>
      {children}
    </div>
  );

  const Select = ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 12,
        border: "1px solid #e5e5e5",
        background: "#fff",
        fontSize: 16,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  const Input = ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 12,
        border: "1px solid #e5e5e5",
        background: "#fff",
        fontSize: 16,
      }}
    />
  );

  function addItem() {
    const title = draftTitle.trim();
    if (!title) {
      setError("Введите название (хотя бы пару символов).");
      return;
    }

    const next: Item = {
      id: safeId(),
      type: draftType,
      source: draftSource,
      title,
      vibe: draftVibe,
      createdAt: Date.now(),
    };

    setItems((prev) => [next, ...prev]);
    setDraftTitle("");
    setError(null);
    setScreen("library");
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function clearAll() {
    setItems([]);
  }

  if (!hasTg) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont" }}>
        <h1 style={{ marginBottom: 8 }}>EveryYou</h1>
        <p style={{ marginTop: 0, color: "crimson" }}>Открой мини-приложение внутри Telegram.</p>
      </main>
    );
  }

  if (!ready) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont" }}>
        <h1 style={{ marginBottom: 8 }}>EveryYou</h1>
        <p style={{ marginTop: 0, opacity: 0.8 }}>Загрузка…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont" }}>
      <h1 style={{ marginBottom: 6 }}>{header.title}</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>{header.subtitle}</p>

      {/* nav */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <Chip active={screen === "home"} label="Home" onClick={() => setScreen("home")} />
        <Chip active={screen === "add"} label="Add content" onClick={() => setScreen("add")} />
        <Chip active={screen === "library"} label="Library" onClick={() => setScreen("library")} />
        <Chip active={screen === "analysis"} label="Analysis" onClick={() => setScreen("analysis")} />
      </div>

      {/* HOME */}
      {screen === "home" && (
        <>
          <Card>
            <p style={{ margin: 0, fontWeight: 900 }}>Что делаем дальше</p>
            <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
              Добавляем контент → помечаем “виб” → смотрим срез за 7/30 дней или за всё время.
            </p>
          </Card>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <Button onClick={() => setScreen("add")}>→ Add content</Button>
            <Button onClick={() => setScreen("library")} variant="ghost">
              → Library
            </Button>
            <Button onClick={() => setScreen("analysis")} variant="ghost">
              → Analysis
            </Button>
          </div>

          <Card>
            <p style={{ margin: 0, opacity: 0.8 }}>
              Сейчас в библиотеке: <b>{items.length}</b>
            </p>
          </Card>
        </>
      )}

      {/* ADD */}
      {screen === "add" && (
        <>
          <Card>
            <p style={{ margin: 0, fontWeight: 900 }}>Добавить вручную</p>
            <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
              Название можно как угодно. Главное — чтобы вы потом сами поняли, что это было.
            </p>
          </Card>

          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            <div>
              <FieldLabel>Тип</FieldLabel>
              <Select
                value={draftType}
                onChange={(v) => setDraftType(v as ItemType)}
                options={[
                  { value: "book", label: "Книга" },
                  { value: "movie", label: "Фильм" },
                  { value: "music", label: "Музыка" },
                ]}
              />
            </div>

            <div>
              <FieldLabel>Источник</FieldLabel>
              <Select
                value={draftSource}
                onChange={(v) => setDraftSource(v as Source)}
                options={[
                  { value: "Manual", label: "Вручную" },
                  { value: "Spotify", label: "Spotify" },
                  { value: "Goodreads", label: "Goodreads" },
                  { value: "Letterboxd", label: "Letterboxd" },
                ]}
              />
            </div>

            <div>
              <FieldLabel>Виб</FieldLabel>
              <Select
                value={draftVibe}
                onChange={(v) => setDraftVibe(v as Vibe)}
                options={VIBES.map((v) => ({ value: v, label: v }))}
              />
            </div>

            <div>
              <FieldLabel>Название</FieldLabel>
              <Input
                value={draftTitle}
                onChange={(v) => {
                  setDraftTitle(v);
                  if (error) setError(null);
                }}
                placeholder="Например: The Cost of Living — Deborah Levy"
              />
              {error && (
                <p style={{ marginTop: 8, marginBottom: 0, color: "#b42318", fontWeight: 800 }}>
                  {error}
                </p>
              )}
            </div>

            <Button onClick={addItem} disabled={!draftTitle.trim()}>
              + Добавить в Library
            </Button>

            <Button onClick={() => setScreen("library")} variant="ghost">
              → Перейти в Library
            </Button>
          </div>
        </>
      )}

      {/* LIBRARY */}
      {screen === "library" && (
        <>
          <Card>
            <p style={{ margin: 0, fontWeight: 900 }}>Библиотека</p>
            <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
              Всё хранится локально (localStorage). Если захотите — позже сделаем экспорт/импорт.
            </p>
          </Card>

          {items.length === 0 ? (
            <Card>
              <p style={{ margin: 0, fontWeight: 900 }}>Пока пусто</p>
              <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
                Добавьте первый айтем — и уже можно будет смотреть анализ.
              </p>
              <div style={{ marginTop: 12 }}>
                <Button onClick={() => setScreen("add")}>→ Add content</Button>
              </div>
            </Card>
          ) : (
            <>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {items.map((i) => (
                  <div
                    key={i.id}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      border: "1px solid #e5e5e5",
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 950 }}>{i.title}</div>
                    <div style={{ marginTop: 6, opacity: 0.7, fontSize: 14 }}>
                      {i.source} • {typeLabel(i.type)} • {i.vibe} • {formatDate(i.createdAt)}
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <Button onClick={() => removeItem(i.id)} variant="ghost">
                        Удалить
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <Button onClick={() => setScreen("add")}>+ Добавить ещё</Button>
                <Button onClick={() => setScreen("analysis")} variant="ghost">
                  → Перейти в Analysis
                </Button>
                <Button onClick={clearAll} variant="danger">
                  Очистить библиотеку
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* ANALYSIS */}
      {screen === "analysis" && (
        <>
          <Card>
            <p style={{ margin: 0, fontWeight: 900 }}>Период</p>
            <div style={{ marginTop: 10 }}>
              <Select
                value={period}
                onChange={(v) => setPeriod(v as Period)}
                options={[
                  { value: "7", label: "Последние 7 дней" },
                  { value: "30", label: "Последние 30 дней" },
                  { value: "all", label: "Всё время" },
                ]}
              />
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card>
              <p style={{ margin: 0, fontWeight: 900 }}>За этот период пусто</p>
              <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
                Добавьте пару айтемов — и уже будет что анализировать.
              </p>
              <div style={{ marginTop: 12 }}>
                <Button onClick={() => setScreen("add")}>→ Add content</Button>
              </div>
            </Card>
          ) : (
            <>
              <Card>
                <p style={{ margin: 0, fontWeight: 900 }}>Сводка</p>
                <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.85 }}>
                  Всего: <b>{stats.total}</b> • Книги: <b>{stats.books}</b> • Фильмы:{" "}
                  <b>{stats.movies}</b> • Музыка: <b>{stats.music}</b>
                </p>
              </Card>

              <Card>
                <p style={{ margin: 0, fontWeight: 900 }}>Топ вибов</p>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {stats.vibeTop.map(([v, n]) => (
                    <div
                      key={v}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        background: "#fff",
                        border: "1px solid #e5e5e5",
                        borderRadius: 12,
                        padding: 12,
                        fontWeight: 850,
                      }}
                    >
                      <span>{v}</span>
                      <span style={{ opacity: 0.7 }}>{n}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <p style={{ margin: 0, fontWeight: 900 }}>Последние айтемы</p>
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {stats.latest.map((i) => (
                    <div
                      key={i.id}
                      style={{
                        background: "#fff",
                        border: "1px solid #e5e5e5",
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div style={{ fontWeight: 950 }}>{i.title}</div>
                      <div style={{ marginTop: 6, opacity: 0.7, fontSize: 14 }}>
                        {typeLabel(i.type)} • {i.source} • {i.vibe} • {formatDate(i.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <Button onClick={() => setScreen("add")}>+ Добавить контента</Button>
                <Button onClick={() => setScreen("library")} variant="ghost">
                  → Открыть Library
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
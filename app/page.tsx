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

type Item = {
  id: string;
  type: ItemType;
  title: string;
  source: Source;
  createdAt: number;
};

const STORAGE_KEY = "everyyou_items_v1";

function safeId(): string {
  // crypto.randomUUID работает почти везде, но на всякий — фоллбек.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function typeLabel(t: ItemType) {
  if (t === "book") return "Книга";
  if (t === "movie") return "Фильм";
  return "Музыка";
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [hasTg, setHasTg] = useState(false);
  const [user, setUser] = useState<TgUser | null>(null);

  const [screen, setScreen] = useState<Screen>("home");

  const [items, setItems] = useState<Item[]>([]);

  // форма Add content
  const [draftType, setDraftType] = useState<ItemType>("book");
  const [draftSource, setDraftSource] = useState<Source>("Manual");
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  // загрузка из localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Item[];
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {
      // игнор
    }
  }, []);

  // сохранение в localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // игнор
    }
  }, [items]);

  const name = user?.first_name ?? "друг";

  const header = useMemo(() => {
    switch (screen) {
      case "home":
        return { title: "EveryYou", subtitle: `Привет, ${name} 👋` };
      case "add":
        return { title: "Add content", subtitle: "Добавим вручную — без интеграций" };
      case "library":
        return { title: "Library", subtitle: "Ваш список контента" };
      case "analysis":
        return { title: "Analysis", subtitle: "Разбор по кнопке (пока мок)" };
    }
  }, [screen, name]);

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
        fontWeight: 700,
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
        fontWeight: 700,
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
    <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6, opacity: 0.75 }}>
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

  function runAnalysis() {
    // мок: очень коротко и без “магии”
    const total = items.length;
    const books = items.filter((i) => i.type === "book").length;
    const movies = items.filter((i) => i.type === "movie").length;
    const music = items.filter((i) => i.type === "music").length;

    const hint =
      music > books + movies
        ? "Музыки больше всего — возможно, вы проживали состояние через звук."
        : books >= movies
        ? "Книг много — вы скорее “перевариваете” мысли текстом."
        : "Фильмов много — вы ловите эмоции через визуал и сюжет.";

    alert(
      `Пока это заглушка анализа.\n\nВсего: ${total}\nКниги: ${books}\nФильмы: ${movies}\nМузыка: ${music}\n\n${hint}`
    );
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

      {/* Навигация */}
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
            <p style={{ margin: 0, fontWeight: 800 }}>Что делаем дальше</p>
            <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
              Пока без интеграций: вручную добавляем контент → копим библиотеку → жмём «анализ» когда хочется.
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
            <p style={{ margin: 0, fontWeight: 800 }}>Добавить вручную</p>
            <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
              Введите название как вам удобно: «Книга — Автор», «Фильм (год)», «Трек/плейлист».
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
                <p style={{ marginTop: 8, marginBottom: 0, color: "#b42318", fontWeight: 700 }}>
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
            <p style={{ margin: 0, fontWeight: 800 }}>Библиотека</p>
            <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
              Записи сохраняются на устройстве (localStorage). Перезапуск Telegram не сбросит список.
            </p>
          </Card>

          {items.length === 0 ? (
            <Card>
              <p style={{ margin: 0, fontWeight: 800 }}>Пока пусто</p>
              <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
                Добавьте первый айтем — и дальше станет веселее.
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
                    <div style={{ fontWeight: 900 }}>{i.title}</div>
                    <div style={{ marginTop: 6, opacity: 0.7, fontSize: 14 }}>
                      {i.source} • {typeLabel(i.type)}
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
            <p style={{ margin: 0, fontWeight: 800 }}>Анализ</p>
            <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
              Сейчас — мок, но уже «по делу». Следом добавим: период, тональность, и текст-резюме как у “wrapped”, но по
              кнопке.
            </p>
          </Card>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <Button onClick={runAnalysis} disabled={items.length === 0}>
              Запустить анализ (mock)
            </Button>
            <Button onClick={() => setScreen("add")} variant="ghost">
              + Добавить контента
            </Button>
            <Button onClick={() => setScreen("library")} variant="ghost">
              → Посмотреть Library
            </Button>
          </div>

          {items.length === 0 && (
            <Card>
              <p style={{ margin: 0, opacity: 0.8 }}>
                Анализу пока нечего жевать. Добавьте хотя бы 2–3 айтема.
              </p>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
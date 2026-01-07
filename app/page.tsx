"use client";

import { useEffect, useMemo, useState } from "react";

type TgUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type Screen = "home" | "add" | "library" | "analysis";

type Item = {
  id: string;
  type: "book" | "movie" | "music";
  title: string;
  source: "Goodreads" | "Letterboxd" | "Spotify";
};

export default function Home() {
  const [ready, setReady] = useState(false);
  const [hasTg, setHasTg] = useState(false);
  const [user, setUser] = useState<TgUser | null>(null);

  const [screen, setScreen] = useState<Screen>("home");

  // мок-данные, чтобы уже было “похоже на продукт”
  const [items, setItems] = useState<Item[]>([
    {
      id: "1",
      type: "book",
      title: "The Cost of Living — Deborah Levy",
      source: "Goodreads",
    },
    {
      id: "2",
      type: "movie",
      title: "Personal Shopper (2016)",
      source: "Letterboxd",
    },
    {
      id: "3",
      type: "music",
      title: "Sad playlist (placeholder)",
      source: "Spotify",
    },
  ]);

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

  const name = user?.first_name ?? "друг";

  const header = useMemo(() => {
    switch (screen) {
      case "home":
        return { title: "EveryYou", subtitle: `Привет, ${name} 👋` };
      case "add":
        return { title: "Add content", subtitle: "Подключим источники" };
      case "library":
        return { title: "Library", subtitle: "Всё, что вы посмотрели/прочитали/послушали" };
      case "analysis":
        return { title: "Analysis", subtitle: "Разбор по кнопке" };
    }
  }, [screen, name]);

  const Button = ({
    children,
    onClick,
    variant = "primary",
  }: {
    children: React.ReactNode;
    onClick: () => void;
    variant?: "primary" | "ghost";
  }) => (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "14px 14px",
        borderRadius: 12,
        border: variant === "ghost" ? "1px solid #e5e5e5" : "1px solid #111",
        background: variant === "ghost" ? "#fff" : "#111",
        color: variant === "ghost" ? "#111" : "#fff",
        fontSize: 16,
        fontWeight: 600,
        textAlign: "left",
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
        fontWeight: 600,
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

  const addMockItem = (source: Item["source"]) => {
    const next: Item =
      source === "Spotify"
        ? {
            id: crypto.randomUUID(),
            type: "music",
            title: "New Spotify item (mock)",
            source,
          }
        : source === "Goodreads"
        ? {
            id: crypto.randomUUID(),
            type: "book",
            title: "New Goodreads book (mock)",
            source,
          }
        : {
            id: crypto.randomUUID(),
            type: "movie",
            title: "New Letterboxd movie (mock)",
            source,
          };

    setItems((prev) => [next, ...prev]);
  };

  const runAnalysis = () => {
    // заглушка — позже подключим GPT и период
    const moodHint =
      items.some((i) => i.type === "music") ? "кажется, у вас тут была музыка для «подумать»" : "контента пока мало";
    alert(`Пока это заглушка анализа — но уже скоро.\n\nСейчас: ${moodHint}.`);
  };

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

      {/* Экраны */}
      {screen === "home" && (
        <>
          <Card>
            <p style={{ margin: 0, fontWeight: 700 }}>Что делаем дальше</p>
            <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
              Подключаем источники → собираем библиотеку → жмём «анализ» когда хочется.
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
        </>
      )}

      {screen === "add" && (
        <>
          <Card>
            <p style={{ margin: 0, opacity: 0.8 }}>
              Пока это «псевдо-подключение»: по кнопке мы добавляем мок-элемент в библиотеку. Дальше заменим на OAuth /
              импорт.
            </p>
          </Card>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <Button onClick={() => addMockItem("Spotify")}>+ Подключить Spotify (mock)</Button>
            <Button onClick={() => addMockItem("Goodreads")} variant="ghost">
              + Подключить Goodreads (mock)
            </Button>
            <Button onClick={() => addMockItem("Letterboxd")} variant="ghost">
              + Подключить Letterboxd (mock)
            </Button>
          </div>

          <div style={{ marginTop: 14 }}>
            <Button onClick={() => setScreen("library")} variant="ghost">
              → Перейти в Library
            </Button>
          </div>
        </>
      )}

      {screen === "library" && (
        <>
          <Card>
            <p style={{ margin: 0, fontWeight: 700 }}>Ваш контент</p>
            <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
              Сейчас тут мок-список. Потом будет реальный импорт.
            </p>
          </Card>

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
                <div style={{ fontWeight: 700 }}>{i.title}</div>
                <div style={{ marginTop: 6, opacity: 0.7, fontSize: 14 }}>
                  {i.source} • {i.type}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            <Button onClick={() => setScreen("analysis")}>→ Перейти в Analysis</Button>
          </div>
        </>
      )}

      {screen === "analysis" && (
        <>
          <Card>
            <p style={{ margin: 0, fontWeight: 700 }}>Анализ по кнопке</p>
            <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
              Дальше добавим выбор периода (7/30 дней) и короткий вывод «какой контент вы потребляли и что он мог
              отражать».
            </p>
          </Card>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <Button onClick={runAnalysis}>Запустить анализ (mock)</Button>
            <Button onClick={() => setScreen("add")} variant="ghost">
              + Добавить ещё контента
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
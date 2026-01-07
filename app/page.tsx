"use client";

import { useEffect, useMemo, useState } from "react";

type TgUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TabKey = "home" | "add" | "library" | "analysis";

const VIBES = [
  { value: "всё бесит", label: "Всё бесит" },
  { value: "тупо", label: "Тупо" },
  { value: "круто", label: "Круто" },
  { value: "не круто", label: "Не круто" },
  { value: "нужно для дела", label: "Нужно для дела" },
  { value: "хочу вдохновиться", label: "Хочу вдохновиться" },
  { value: "подумать/переварить", label: "Подумать/переварить" },
  { value: "хз если честно", label: "Хз если честно" },
] as const;

export default function Home() {
  const [tab, setTab] = useState<TabKey>("home");

  const [hasTg, setHasTg] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<TgUser | null>(null);

  // Важно: вайб можно оставить пустым
  const [vibe, setVibe] = useState<string>("");

  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg) {
      setHasTg(false);
      setReady(false);
      setUser(null);
      return;
    }

    setHasTg(true);
    try {
      tg.ready();
      setReady(true);
      setUser(tg.initDataUnsafe?.user ?? null);
      // косметика для мини-аппа
      tg.expand?.();
    } catch {
      setReady(false);
    }
  }, []);

  const name = useMemo(() => {
    const first = user?.first_name ?? "";
    const last = user?.last_name ?? "";
    const full = `${first} ${last}`.trim();
    return full || (user?.username ? `@${user.username}` : "там");
  }, [user]);

  const TabButton = ({
    k,
    title,
  }: {
    k: TabKey;
    title: string;
  }) => {
    const active = tab === k;
    return (
      <button
        onClick={() => setTab(k)}
        style={{
          border: "1px solid #E5E7EB",
          background: active ? "#111827" : "#fff",
          color: active ? "#fff" : "#111827",
          padding: "10px 14px",
          borderRadius: 999,
          fontSize: 16,
          lineHeight: "20px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </button>
    );
  };

  const Card = ({
    title,
    text,
    children,
  }: {
    title?: string;
    text?: string;
    children?: React.ReactNode;
  }) => (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 16,
        padding: 16,
        background: "#fff",
      }}
    >
      {title ? (
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          {title}
        </div>
      ) : null}
      {text ? (
        <div style={{ fontSize: 16, opacity: 0.85, marginBottom: children ? 12 : 0 }}>
          {text}
        </div>
      ) : null}
      {children}
    </div>
  );

  const PrimaryButton = ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "14px 16px",
        borderRadius: 14,
        border: "1px solid #111827",
        background: "#111827",
        color: "#fff",
        fontSize: 18,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  const SecondaryButton = ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "14px 16px",
        borderRadius: 14,
        border: "1px solid #E5E7EB",
        background: "#fff",
        color: "#111827",
        fontSize: 18,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <main
      style={{
        padding: 20,
        fontFamily:
          'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        color: "#111827",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
        EveryYou
      </div>

      <div style={{ fontSize: 18, marginBottom: 14 }}>
        Привет, {name} 👋
      </div>

      {!hasTg ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #FCA5A5",
            background: "#FEF2F2",
          }}
        >
          Похоже, вы открыли это не внутри Telegram. Откройте мини-апп из бота —
          тогда подтянется профиль.
        </div>
      ) : !ready ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #FDE68A",
            background: "#FFFBEB",
          }}
        >
          Telegram WebApp найден, но ещё не готов. Перезапустите мини-приложение.
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <TabButton k="home" title="Home" />
        <TabButton k="add" title="Add content" />
        <TabButton k="library" title="Library" />
        <TabButton k="analysis" title="Analysis" />
      </div>

      {tab === "home" && (
        <div style={{ display: "grid", gap: 12 }}>
          <Card
            title="Что делаем дальше"
            text="Подключаем источники → собираем библиотеку → жмём «анализ» когда хочется."
          />

          <PrimaryButton label="→ Add content" onClick={() => setTab("add")} />
          <SecondaryButton label="→ Library" onClick={() => setTab("library")} />
          <SecondaryButton label="→ Analysis" onClick={() => setTab("analysis")} />
        </div>
      )}

      {tab === "add" && (
        <div style={{ display: "grid", gap: 12 }}>
          <Card
            title="Add content"
            text="Пока здесь будет простая форма-заглушка. Дальше подключим Spotify / Goodreads / Letterboxd."
          >
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <label style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Тэги/вайбы</div>

                <select
                  value={vibe}
                  onChange={(e) => setVibe(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid #E5E7EB",
                    fontSize: 16,
                    background: "#fff",
                  }}
                >
                  {/* пустое значение — чтобы можно было не выбирать вайб */}
                  <option value="">—</option>

                  {VIBES.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>

                <div style={{ fontSize: 14, opacity: 0.7 }}>
                  Сейчас выбрано:{" "}
                  <span style={{ fontWeight: 700 }}>
                    {vibe ? vibe : "ничего (и это нормально)"}
                  </span>
                </div>
              </label>

              <SecondaryButton label="Вернуться на Home" onClick={() => setTab("home")} />
            </div>
          </Card>
        </div>
      )}

      {tab === "library" && (
        <div style={{ display: "grid", gap: 12 }}>
          <Card
            title="Library"
            text="Тут появится общий список: книги/фильмы/музыка. С фильтрами по источнику и вайбам."
          />
          <SecondaryButton label="Вернуться на Home" onClick={() => setTab("home")} />
        </div>
      )}

      {tab === "analysis" && (
        <div style={{ display: "grid", gap: 12 }}>
          <Card
            title="Analysis"
            text="Период + вайбчек"
          />
          <SecondaryButton label="Вернуться на Home" onClick={() => setTab("home")} />
        </div>
      )}
    </main>
  );
}
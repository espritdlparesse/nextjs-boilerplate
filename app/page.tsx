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
  { value: "всё бесит", label: "всё бесит" },
  { value: "тупо", label: "тупо" },
  { value: "круто", label: "круто" },
  { value: "не круто", label: "не круто" },
  { value: "нужно для дела", label: "нужно для дела" },
  { value: "хочу вдохновиться", label: "хочу вдохновиться" },
  { value: "подумать/переварить", label: "подумать/переварить" },
  { value: "хз если честно", label: "хз если честно" },
] as const;

const CONTENT_TYPES = [
  { value: "music", label: "музыка" },
  { value: "book", label: "книга" },
  { value: "movie", label: "фильм" },
] as const;

const SOURCES = [
  { value: "spotify", label: "spotify" },
  { value: "goodreads", label: "goodreads" },
  { value: "letterboxd", label: "letterboxd" },
  { value: "manual", label: "вручную" },
] as const;

function Badge({ tone, text }: { tone: "ok" | "soon" | "off"; text: string }) {
  const style =
    tone === "ok"
      ? { border: "1px solid #10B981", background: "#ECFDF5", color: "#065F46" }
      : tone === "soon"
      ? { border: "1px solid #F59E0B", background: "#FFFBEB", color: "#92400E" }
      : { border: "1px solid #E5E7EB", background: "#F9FAFB", color: "#374151" };

  return (
    <span
      style={{
        ...style,
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 700,
        width: "fit-content",
      }}
    >
      {text}
    </span>
  );
}

function Row({
  title,
  desc,
  right,
}: {
  title: string;
  desc: string;
  right: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "12px 0",
        borderTop: "1px solid #E5E7EB",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 14, opacity: 0.8 }}>{desc}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{right}</div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 800 }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 14,
          border: "1px solid #E5E7EB",
          fontSize: 16,
          background: "#fff",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Page() {
  const [tab, setTab] = useState<TabKey>("home");

  const [hasTg, setHasTg] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<TgUser | null>(null);

  // тэги/вайбы: можно оставить пустым
  const [vibe, setVibe] = useState<string>("");

  // тип и источник: вернуть
  const [contentType, setContentType] = useState<string>("music");
  const [source, setSource] = useState<string>("spotify");

  // источники (пока фейковые)
  const [spotifyConnected, setSpotifyConnected] = useState(false);

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

  const TabButton = ({ k, title }: { k: TabKey; title: string }) => {
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
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
          {title}
        </div>
      ) : null}
      {text ? (
        <div
          style={{
            fontSize: 16,
            opacity: 0.85,
            marginBottom: children ? 12 : 0,
          }}
        >
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

  const SmallButton = ({
    label,
    onClick,
    kind = "primary",
    disabled,
  }: {
    label: string;
    onClick: () => void;
    kind?: "primary" | "ghost";
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border:
          kind === "primary" ? "1px solid #111827" : "1px solid #E5E7EB",
        background: kind === "primary" ? "#111827" : "#fff",
        color: kind === "primary" ? "#fff" : "#111827",
        fontSize: 14,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
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
      <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>
        everyyou
      </div>

      <div style={{ fontSize: 18, marginBottom: 14 }}>
        привет, {name} 👋
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
          вы открыли это не внутри telegram. откройте мини-апп из бота — тогда
          подтянется профиль.
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
          telegram webapp найден, но ещё не готов. перезапустите мини-приложение.
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
        <TabButton k="home" title="home" />
        <TabButton k="add" title="add content" />
        <TabButton k="library" title="library" />
        <TabButton k="analysis" title="analysis" />
      </div>

      {tab === "home" && (
        <div style={{ display: "grid", gap: 12 }}>
          <Card
            title="что это"
            text="everyyou собирает весь контент, который вы потребляете: книги, фильмы, музыка. приложение помогает осознать, как этот контент влияет на настроение и состояние."
          />

          <Card
            title="что делаем дальше"
            text="подключаем источники → собираем библиотеку → жмём «анализ» когда хочется."
          />

          <PrimaryButton label="→ add content" onClick={() => setTab("add")} />
          <SecondaryButton label="→ library" onClick={() => setTab("library")} />
          <SecondaryButton label="→ analysis" onClick={() => setTab("analysis")} />
        </div>
      )}

      {tab === "add" && (
        <div style={{ display: "grid", gap: 12 }}>
          <Card
            title="add content"
            text="пока здесь будет простая форма-заглушка. дальше подключим spotify / goodreads / letterboxd."
          >
            <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
              <SelectField
                label="тип"
                value={contentType}
                onChange={setContentType}
                options={CONTENT_TYPES as unknown as { value: string; label: string }[]}
              />
              <SelectField
                label="источник"
                value={source}
                onChange={setSource}
                options={SOURCES as unknown as { value: string; label: string }[]}
              />
            </div>
          </Card>

          <Card title="источники" text="подключаем базу: spotify, goodreads, letterboxd.">
            <Row
              title="spotify"
              desc="музыка и плейлисты. потом будем тянуть историю прослушиваний."
              right={
                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  {spotifyConnected ? (
                    <Badge tone="ok" text="подключено" />
                  ) : (
                    <Badge tone="off" text="не подключено" />
                  )}
                  <SmallButton
                    label={spotifyConnected ? "отключить" : "подключить"}
                    onClick={() => setSpotifyConnected((v) => !v)}
                    kind="primary"
                  />
                </div>
              }
            />

            <Row
              title="goodreads"
              desc="книги. авторизацию добавим позже."
              right={
                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <Badge tone="soon" text="скоро" />
                  <SmallButton
                    label="подключить"
                    onClick={() => {}}
                    kind="ghost"
                    disabled
                  />
                </div>
              }
            />

            <Row
              title="letterboxd"
              desc="фильмы. авторизацию добавим позже."
              right={
                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <Badge tone="soon" text="скоро" />
                  <SmallButton
                    label="подключить"
                    onClick={() => {}}
                    kind="ghost"
                    disabled
                  />
                </div>
              }
            />
          </Card>

          <Card title="тэги/вайбы" text="можно выбрать, а можно оставить пустым.">
            <label style={{ display: "grid", gap: 8 }}>
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
                <option value="">—</option>
                {VIBES.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>

              <div style={{ fontSize: 14, opacity: 0.7 }}>
                сейчас выбрано:{" "}
                <span style={{ fontWeight: 800 }}>
                  {vibe ? vibe : "ничего"}
                </span>
                , это поле можно оставить пустым
              </div>
            </label>
          </Card>

          <SecondaryButton label="вернуться на home" onClick={() => setTab("home")} />
        </div>
      )}

      {tab === "library" && (
        <div style={{ display: "grid", gap: 12 }}>
          <Card
            title="library"
            text="тут появится общий список: книги/фильмы/музыка. начнём с музыки (spotify), потом добавим остальное."
          />
          <SecondaryButton label="вернуться на home" onClick={() => setTab("home")} />
        </div>
      )}

      {tab === "analysis" && (
        <div style={{ display: "grid", gap: 12 }}>
          <Card title="analysis" text="период + вайбчек" />
          <SecondaryButton label="вернуться на home" onClick={() => setTab("home")} />
        </div>
      )}
    </main>
  );
}
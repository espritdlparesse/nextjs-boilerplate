"use client";

import { useEffect, useState } from "react";

type TgUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export default function Home() {
  const [ready, setReady] = useState(false);
  const [hasTg, setHasTg] = useState(false);
  const [user, setUser] = useState<TgUser | null>(null);

  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;

    if (!tg) {
      setHasTg(false);
      return;
    }

    setHasTg(true);

    // Сообщаем Telegram, что мини-апп готов
    tg.ready();

    // Раскрываем на весь экран
    tg.expand();

    // Цвета под натив
    try {
      tg.setHeaderColor?.("#ffffff");
      tg.setBackgroundColor?.("#ffffff");
    } catch {}

    // Лёгкий haptic на старте
    try {
      tg.HapticFeedback?.impactOccurred?.("light");
    } catch {}

    setUser(tg.initDataUnsafe?.user ?? null);
    setReady(true);
  }, []);

  const name = user?.first_name ?? "друг";

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>EveryYou</h1>

      {!ready && <p>Загрузка…</p>}

      {ready && (
        <>
          <p style={{ marginTop: 0, opacity: 0.8 }}>
            Привет, {name} 👋
          </p>

          <div
            style={{
              marginTop: 24,
              padding: 16,
              borderRadius: 12,
              background: "#f5f5f5",
            }}
          >
            <p style={{ margin: 0 }}>
              Mini App skeleton is alive.
            </p>
          </div>

          <p style={{ marginTop: 24, opacity: 0.6, fontSize: 14 }}>
            Next: Home → Add content → Library → Analysis
          </p>
        </>
      )}

      {!hasTg && (
        <p style={{ marginTop: 16, color: "red" }}>
          Открой приложение внутри Telegram
        </p>
      )}
    </main>
  );
}
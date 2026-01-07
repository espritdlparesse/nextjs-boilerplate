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
  const [user, setUser] = useState<TgUser | null>(null);
  const [hasTg, setHasTg] = useState(false);

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

  const name =
    user ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() : "—";

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 6 }}>EveryYou</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Mini App skeleton is alive.
      </p>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 14,
          border: "1px solid #e5e5e5",
          background: "white",
        }}
      >
        <div style={{ marginBottom: 8 }}>
          Telegram WebApp detected: <b>{hasTg ? "YES" : "NO"}</b>
        </div>
        <div style={{ marginBottom: 8 }}>
          Telegram WebApp ready:{" "}
          <b>{ready ? "YES" : "NO (open inside Telegram)"}</b>
        </div>
        <div>
          User: <b>{name}</b>
          {user?.username ? (
            <span style={{ opacity: 0.7 }}> (@{user.username})</span>
          ) : null}
        </div>

        <button
          onClick={() => alert("ping")}
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
          }}
        >
          Ping
        </button>
      </div>

      <p style={{ marginTop: 16, opacity: 0.7 }}>
        Next: Home → Add content → Library → Analysis.
      </p>
    </main>
  );
}
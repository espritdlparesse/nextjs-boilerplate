"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg) return;

    tg.ready();
    setUser(tg.initDataUnsafe?.user);
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>EveryYou</h1>

      {user ? (
        <p>Привет, {user.first_name} 👋</p>
      ) : (
        <p>Открой через Telegram кнопку</p>
      )}
    </main>
  );
}
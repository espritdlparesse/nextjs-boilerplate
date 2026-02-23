"use client";

import { useState } from "react";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function runSummary() {
    setLoading(true);
    setError("");
    setSummary("");

    try {
      const res = await fetch("/api/summary", { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error ?? "Request failed");
        return;
      }

      setSummary(json?.summary ?? "");
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "40px auto",
        padding: "0 16px",
        fontFamily: "system-ui",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>EveryYou</h1>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>что это</h2>
        <p>
          EveryYou помогает собрать весь потребляемый контент в одном месте.
          Музыка, книги и фильмы фиксируются в вашей библиотеке.
        </p>
        <p style={{ marginTop: 12 }}>
          Когда данных накопится достаточно, можно провести вайбчек и увидеть общую динамику.
        </p>
      </section>

      <button
        onClick={runSummary}
        disabled={loading}
        style={{
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid #ddd",
          background: loading ? "#f3f3f3" : "white",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: 16,
        }}
      >
        {loading ? "Провожу вайбчек…" : "Провести вайбчек"}
      </button>

      {error && (
        <p style={{ marginTop: 16, color: "crimson" }}>
          {error}
        </p>
      )}

      {summary && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            border: "1px solid #eee",
            borderRadius: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {summary}
        </div>
      )}
    </main>
  );
}

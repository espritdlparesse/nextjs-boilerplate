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
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>EveryYou</h1>

      <button
        onClick={runSummary}
        disabled={loading}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: loading ? "#f3f3f3" : "white",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Думаю..." : "Проанализировать мой контент"}
      </button>

      {error && (
        <p style={{ marginTop: 16, color: "crimson" }}>
          {error}
        </p>
      )}

      {summary && (
        <div style={{ marginTop: 20, padding: 16, border: "1px solid #eee", borderRadius: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {summary}
        </div>
      )}
    </main>
  );
}

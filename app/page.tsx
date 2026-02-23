"use client";

import { useMemo, useState } from "react";

type Tab = "home" | "add" | "library" | "vibe";

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: active ? "1px solid #000" : "1px solid #e6e6e6",
        background: active ? "#000" : "#fff",
        color: active ? "#fff" : "#000",
        fontWeight: 600,
        cursor: "pointer",
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

function ActionButton({
  label,
  variant = "primary",
  disabled,
  onClick,
}: {
  label: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: "100%",
        padding: "14px 16px",
        borderRadius: 14,
        border: isPrimary ? "1px solid #000" : "1px solid #e6e6e6",
        background: isPrimary ? "#000" : "#fff",
        color: isPrimary ? "#fff" : "#000",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <span aria-hidden style={{ fontWeight: 900 }}>
        →
      </span>
      <span>{label}</span>
    </button>
  );
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("home");

  // summary flow
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

  const headerTitle = useMemo(() => {
    if (tab === "home") return "что это";
    if (tab === "add") return "add content";
    if (tab === "library") return "library";
    return "вайбчек";
  }, [tab]);

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "24px auto",
        padding: "0 16px 40px",
        fontFamily: "system-ui",
        color: "#000",
      }}
    >
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -0.5 }}>everyyou</div>
        <div style={{ marginTop: 8, fontSize: 18, color: "#444" }}>привет!</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <Pill active={tab === "home"} onClick={() => setTab("home")}>
          home
        </Pill>
        <Pill active={tab === "add"} onClick={() => setTab("add")}>
          add content
        </Pill>
        <Pill active={tab === "library"} onClick={() => setTab("library")}>
          library
        </Pill>
        <Pill active={tab === "vibe"} onClick={() => setTab("vibe")}>
          vibe check
        </Pill>
      </div>

      <section
        style={{
          marginTop: 16,
          border: "1px solid #e9e9e9",
          borderRadius: 18,
          padding: 18,
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.2, textTransform: "lowercase" }}>
          {headerTitle}
        </div>

        {/* HOME */}
        {tab === "home" && (
          <>
            <div style={{ marginTop: 12, fontSize: 18, lineHeight: 1.55, color: "#222" }}>
              <p style={{ margin: 0 }}>
                EveryYou помогает собрать весь потребляемый контент в одном месте. Музыка, книги и фильмы фиксируются в вашей
                библиотеке.
              </p>
              <p style={{ margin: "12px 0 0" }}>
                Когда данных накопится достаточно, можно провести вайбчек и увидеть общую динамику.
              </p>
            </div>

            <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
              <ActionButton
                label="добавить контент"
                variant="primary"
                onClick={() => setTab("add")}
              />
              <ActionButton
                label="открыть библиотеку"
                variant="secondary"
                onClick={() => setTab("library")}
              />
              <ActionButton
                label="вайбчек"
                variant="secondary"
                onClick={() => setTab("vibe")}
              />
            </div>

            <div style={{ marginTop: 14, fontSize: 12, color: "#777" }}>
              telegram webapp: detected · ready: yes
            </div>
          </>
        )}

        {/* ADD CONTENT (заглушка, чтобы UI был как раньше) */}
        {tab === "add" && (
          <div style={{ marginTop: 12, fontSize: 16, lineHeight: 1.55, color: "#222" }}>
            <p style={{ margin: 0 }}>
              импорт — чтобы быстро накидать музыки. сами добавили — чтобы внести вообще что угодно.
            </p>
            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <ActionButton label="импорт" variant="secondary" onClick={() => alert("Импорт подключим следующим шагом")} />
              <ActionButton label="добавить в библиотеку" variant="primary" disabled />
            </div>
          </div>
        )}

        {/* LIBRARY (заглушка, чтобы UI был как раньше) */}
        {tab === "library" && (
          <div style={{ marginTop: 12, fontSize: 16, lineHeight: 1.55, color: "#222" }}>
            <p style={{ margin: 0 }}>
              Здесь будет ваша библиотека: музыка, книги и фильмы — всё в одном месте.
            </p>
            <div style={{ marginTop: 14 }}>
              <ActionButton label="добавить контент" variant="secondary" onClick={() => setTab("add")} />
            </div>
          </div>
        )}

        {/* VIBE CHECK */}
        {tab === "vibe" && (
          <>
            <div style={{ marginTop: 12, fontSize: 18, lineHeight: 1.55, color: "#222" }}>
              <p style={{ margin: 0 }}>
                Здесь можно провести вайбчек всей вашей библиотеки. Алгоритм анализирует сохранённый контент и собирает общий
                портрет периода.
              </p>
              <p style={{ margin: "12px 0 0" }}>
                Это пока демо-версия — не относитесь к результатам слишком строго.
              </p>
            </div>

            <div style={{ marginTop: 18 }}>
              <ActionButton
                label={loading ? "провожу вайбчек…" : "провести вайбчек"}
                variant="primary"
                disabled={loading}
                onClick={runSummary}
              />
            </div>

            {error && (
              <div style={{ marginTop: 12, color: "crimson", fontSize: 14 }}>
                {error}
              </div>
            )}

            {summary && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  border: "1px solid #eee",
                  borderRadius: 14,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.55,
                  fontSize: 16,
                }}
              >
                {summary}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

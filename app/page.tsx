"use client";

import { useEffect, useMemo, useState } from "react";

type Tab = "home" | "add" | "library" | "vibe";
type ItemType = "music" | "book" | "movie";
type ItemSource = "manual" | "spotify" | "goodreads" | "letterboxd";

type Item = {
  id: string | number;
  tg_user_id?: number;
  type: ItemType;
  source?: string | null;
  title: string;
  creator?: string | null; // важно: в твоём API это creator
  created_at?: string | null;
  updated_at?: string | null;
};

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

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid #e6e6e6",
        fontSize: 12,
        fontWeight: 600,
        color: "#222",
        background: "#fff",
        lineHeight: 1,
      }}
    >
      {children}
    </span>
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

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          textTransform: "lowercase",
          color: "#222",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "12px 12px",
          borderRadius: 12,
          border: "1px solid #e6e6e6",
          outline: "none",
          fontSize: 16,
          background: "#fff",
        }}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          textTransform: "lowercase",
          color: "#222",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "12px 12px",
          borderRadius: 12,
          border: "1px solid #e6e6e6",
          outline: "none",
          fontSize: 16,
          background: "#fff",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ✅ динамические плейсхолдеры (как на старых скринах по смыслу)
function titlePlaceholder(type: ItemType | "") {
  if (type === "music") return "например: cellophane";
  if (type === "book") return "например: the idiot";
  if (type === "movie") return "например: drive my car";
  return "например: название";
}

function creatorPlaceholder(type: ItemType | "") {
  if (type === "music") return "например: fka twigs";
  if (type === "book") return "например: elif batuman";
  if (type === "movie") return "например: ryusuke hamaguchi";
  return "например: автор / исполнитель";
}

function typeLabel(t: ItemType) {
  if (t === "music") return "музыка";
  if (t === "book") return "книга";
  return "фильм";
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>("home");

  // vibe summary
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [summaryError, setSummaryError] = useState<string>("");

  // add content
  const [type, setType] = useState<ItemType | "">("");
  const [source, setSource] = useState<ItemSource | "">("");
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>("");

  // library
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string>("");
  const [filterType, setFilterType] = useState<ItemType | "all">("all");

  const headerTitle = useMemo(() => {
    if (tab === "home") return "что это";
    if (tab === "add") return "add content";
    if (tab === "library") return "library";
    return "вайбчек";
  }, [tab]);

  async function runSummary() {
    setLoadingSummary(true);
    setSummaryError("");
    setSummary("");

    try {
      const res = await fetch("/api/summary", { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSummaryError(json?.error ?? "Request failed");
        return;
      }

      setSummary(json?.summary ?? "");
    } catch (e: any) {
      setSummaryError(e?.message ?? "Network error");
    } finally {
      setLoadingSummary(false);
    }
  }

  async function loadItems() {
    setItemsLoading(true);
    setItemsError("");

    try {
      const res = await fetch("/api/items", { method: "GET" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setItemsError(json?.error ?? "Failed to load items");
        return;
      }

      const list = (json?.items ?? []) as Item[];
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setItemsError(e?.message ?? "Network error");
    } finally {
      setItemsLoading(false);
    }
  }

  async function addItem() {
    setSaving(true);
    setSaveError("");

    try {
      // ✅ важно: creator (как у тебя в API), НЕ author_or_artist
      const payload = {
        type,
        source,
        title,
        creator: creator || null,
      };

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSaveError(json?.error ?? "Failed to save");
        return;
      }

      setTitle("");
      setCreator("");

      await loadItems();
      setTab("library");
    } catch (e: any) {
      setSaveError(e?.message ?? "Network error");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (tab === "library") loadItems();
  }, [tab]);

  const filteredItems = useMemo(() => {
    if (filterType === "all") return items;
    return items.filter((it) => it.type === filterType);
  }, [items, filterType]);

  const counts = useMemo(() => {
    const music = items.filter((i) => i.type === "music").length;
    const books = items.filter((i) => i.type === "book").length;
    const movies = items.filter((i) => i.type === "movie").length;
    return { total: items.length, music, books, movies };
  }, [items]);

  const canSave = Boolean(type && source && title.trim());

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
        <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -0.5 }}>
          everyyou
        </div>
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
        <div
          style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: -0.2,
            textTransform: "lowercase",
          }}
        >
          {headerTitle}
        </div>

        {/* HOME */}
        {tab === "home" && (
          <>
            <div style={{ marginTop: 12, fontSize: 18, lineHeight: 1.55, color: "#222" }}>
              <p style={{ margin: 0 }}>
                EveryYou помогает собрать весь потребляемый контент в одном месте. Музыка, книги и фильмы фиксируются в вашей библиотеке.
              </p>
              <p style={{ margin: "12px 0 0" }}>
                Когда данных накопится достаточно, можно провести вайбчек и увидеть общую динамику.
              </p>
            </div>

            <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
              <ActionButton label="добавить контент" variant="primary" onClick={() => setTab("add")} />
              <ActionButton label="открыть библиотеку" variant="secondary" onClick={() => setTab("library")} />
              <ActionButton label="вайбчек" variant="secondary" onClick={() => setTab("vibe")} />
            </div>

            <div style={{ marginTop: 14, fontSize: 12, color: "#777" }}>
              telegram webapp: detected · ready: yes
            </div>
          </>
        )}

        {/* ADD CONTENT */}
        {tab === "add" && (
          <>
            <div style={{ marginTop: 12, fontSize: 16, lineHeight: 1.55, color: "#222" }}>
              импорт — чтобы быстро накидать музыки. сами добавили — чтобы внести вообще что угодно.
            </div>

            <div style={{ marginTop: 14 }}>
              <ActionButton label="импорт" variant="secondary" onClick={() => alert("Импорт подключим следующим шагом")} />
            </div>

            <div style={{ marginTop: 10, fontSize: 13, color: "#666" }}>
              импортировано: 0 треков
            </div>

            <Select
              label="тип"
              value={type}
              onChange={(v) => setType(v as any)}
              placeholder="выберите тип"
              options={[
                { value: "music", label: "музыка" },
                { value: "book", label: "книга" },
                { value: "movie", label: "фильм" },
              ]}
            />

            <Select
              label="источник"
              value={source}
              onChange={(v) => setSource(v as any)}
              placeholder="выберите источник"
              options={[
                { value: "manual", label: "manual" },
                { value: "spotify", label: "spotify" },
                { value: "goodreads", label: "goodreads" },
                { value: "letterboxd", label: "letterboxd" },
              ]}
            />

            <Input label="название" value={title} onChange={setTitle} placeholder={titlePlaceholder(type)} />
            <Input label="автор / исполнитель" value={creator} onChange={setCreator} placeholder={creatorPlaceholder(type)} />

            {saveError && <div style={{ marginTop: 12, color: "crimson", fontSize: 14 }}>{saveError}</div>}

            <div style={{ marginTop: 14 }}>
              <ActionButton
                label={saving ? "добавляю…" : "добавить в библиотеку"}
                variant="primary"
                disabled={!canSave || saving}
                onClick={addItem}
              />
            </div>
          </>
        )}

        {/* LIBRARY */}
        {tab === "library" && (
          <>
            <div style={{ marginTop: 12, fontSize: 15, color: "#444" }}>
              всего в библиотеке: <b>{counts.total}</b> · музыка: <b>{counts.music}</b> · книги: <b>{counts.books}</b> · фильмы: <b>{counts.movies}</b>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <Pill active={filterType === "all"} onClick={() => setFilterType("all")}>всё</Pill>
              <Pill active={filterType === "music"} onClick={() => setFilterType("music")}>музыка</Pill>
              <Pill active={filterType === "book"} onClick={() => setFilterType("book")}>книги</Pill>
              <Pill active={filterType === "movie"} onClick={() => setFilterType("movie")}>фильмы</Pill>
            </div>

            <div style={{ marginTop: 14 }}>
              <ActionButton label="добавить контент" variant="secondary" onClick={() => setTab("add")} />
            </div>

            {itemsLoading && <div style={{ marginTop: 14, fontSize: 14, color: "#666" }}>загружаю…</div>}
            {itemsError && <div style={{ marginTop: 14, fontSize: 14, color: "crimson" }}>{itemsError}</div>}

            {!itemsLoading && !itemsError && filteredItems.length === 0 && (
              <div style={{ marginTop: 14, fontSize: 14, color: "#666" }}>
                Здесь появится ваша библиотека: музыка, книги и фильмы — всё в одном месте.
              </div>
            )}

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {filteredItems.map((it) => (
                <div
                  key={String(it.id)}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 14,
                    background: "#fff",
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.2 }}>{it.title}</div>

                  {it.creator && (
                    <div style={{ marginTop: 6, fontSize: 14, color: "#444" }}>
                      {it.creator}
                    </div>
                  )}

                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Tag>{typeLabel(it.type)}</Tag>
                    <Tag>{it.source ?? "manual"}</Tag>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* VIBE */}
        {tab === "vibe" && (
          <>
            <div style={{ marginTop: 12, fontSize: 18, lineHeight: 1.55, color: "#222" }}>
              <p style={{ margin: 0 }}>
                Здесь можно провести вайбчек всей вашей библиотеки. Алгоритм анализирует сохранённый контент и собирает общий портрет периода.
              </p>
              <p style={{ margin: "12px 0 0" }}>
                Это пока демо-версия — не относитесь к результатам слишком строго.
              </p>
            </div>

            <div style={{ marginTop: 18 }}>
              <ActionButton
                label={loadingSummary ? "провожу вайбчек…" : "провести вайбчек"}
                variant="primary"
                disabled={loadingSummary}
                onClick={runSummary}
              />
            </div>

            {summaryError && <div style={{ marginTop: 12, color: "crimson", fontSize: 14 }}>{summaryError}</div>}

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

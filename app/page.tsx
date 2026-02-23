"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Tab = "home" | "add" | "library" | "vibe";
type ItemType = "music" | "book" | "movie";
type ItemSource = "manual" | "spotify" | "goodreads" | "letterboxd";

type Item = {
  id: string | number;
  type: ItemType;
  source?: string | null;
  title: string;
  creator?: string | null;
  created_at?: string | null;
};

type ImportResult = {
  detectedType: "music" | "book" | "movie" | "unknown";
  detectedSource: "spotify" | "goodreads" | "letterboxd" | "manual";
  confidence: number;
  items: Array<{ type: ItemType; source: ItemSource; title: string; creator?: string | null }>;
  warnings: string[];
};

function tgInitData(): string {
  try {
    // @ts-ignore
    return (window?.Telegram?.WebApp?.initData as string) ?? "";
  } catch {
    return "";
  }
}

function authHeaders(): HeadersInit {
  const initData = tgInitData();
  return initData ? { "x-telegram-init-data": initData } : {};
}

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
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: "lowercase", color: "#222", marginBottom: 6 }}>
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
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: "lowercase", color: "#222", marginBottom: 6 }}>
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

  async function runSummary() {
    setLoadingSummary(true);
    setSummaryError("");
    setSummary("");

    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { ...authHeaders() },
      });
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

  // add content
  const [type, setType] = useState<ItemType | "">("");
  const [source, setSource] = useState<ItemSource | "">("");
  const [title, setTitle] = useState("");
  const [creator, setCreator] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>("");

  // import flow
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string>("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [savingImport, setSavingImport] = useState(false);
  const [savingImportError, setSavingImportError] = useState("");

  function openFilePicker() {
    setImportError("");
    setImportResult(null);
    setSelected({});
    fileInputRef.current?.click();
  }

  async function onFilePicked(file: File | null) {
    if (!file) return;

    setImporting(true);
    setImportError("");
    setImportResult(null);
    setSelected({});

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/import-image", {
        method: "POST",
        headers: { ...authHeaders() },
        body: fd,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(json?.error ?? "Import failed");
        return;
      }

      const result = json as ImportResult;
      setImportResult(result);

      // по умолчанию выберем все
      const sel: Record<number, boolean> = {};
      (result.items ?? []).forEach((_, idx) => (sel[idx] = true));
      setSelected(sel);

      // можем сразу подсказать тип/источник в форме
      if (result.detectedType !== "unknown") setType(result.detectedType);
      setSource(result.detectedSource);
    } catch (e: any) {
      setImportError(e?.message ?? "Network error");
    } finally {
      setImporting(false);
    }
  }

  async function addItemManual() {
    setSaving(true);
    setSaveError("");

    try {
      const payload = {
        type,
        source,
        title,
        creator: creator || null,
      };

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
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

  async function saveImportedItems() {
    if (!importResult) return;
    setSavingImport(true);
    setSavingImportError("");

    try {
      const chosen = importResult.items
        .map((it, idx) => ({ it, idx }))
        .filter(({ idx }) => selected[idx]);

      if (chosen.length === 0) {
        setSavingImportError("Вы ничего не выбрали для сохранения.");
        return;
      }

      // сохраняем по одному через твой POST /api/items
      for (const { it } of chosen) {
        const payload = {
          type: it.type,
          source: it.source,
          title: it.title,
          creator: it.creator ?? null,
        };

        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeaders() },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to save imported item");
        }
      }

      // очистим import state и уйдём в библиотеку
      setImportResult(null);
      setSelected({});
      await loadItems();
      setTab("library");
    } catch (e: any) {
      setSavingImportError(e?.message ?? "Network error");
    } finally {
      setSavingImport(false);
    }
  }

  // library
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string>("");
  const [filterType, setFilterType] = useState<ItemType | "all">("all");

  async function loadItems() {
    setItemsLoading(true);
    setItemsError("");

    try {
      const res = await fetch("/api/items", {
        method: "GET",
        headers: { ...authHeaders() },
      });
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

  const canSaveManual = Boolean(type && source && title.trim());

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
        <Pill active={tab === "home"} onClick={() => setTab("home")}>home</Pill>
        <Pill active={tab === "add"} onClick={() => setTab("add")}>add content</Pill>
        <Pill active={tab === "library"} onClick={() => setTab("library")}>library</Pill>
        <Pill active={tab === "vibe"} onClick={() => setTab("vibe")}>vibe check</Pill>
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

        {/* ADD */}
        {tab === "add" && (
          <>
            <div style={{ marginTop: 12, fontSize: 16, lineHeight: 1.55, color: "#222" }}>
              импорт — чтобы быстро накидать музыки. сами добавили — чтобы внести вообще что угодно.
            </div>

            {/* hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
            />

            <div style={{ marginTop: 14 }}>
              <ActionButton
                label={importing ? "импортирую…" : "импорт"}
                variant="secondary"
                disabled={importing}
                onClick={openFilePicker}
              />
            </div>

            {importError && (
              <div style={{ marginTop: 12, color: "crimson", fontSize: 14 }}>
                {importError}
              </div>
            )}

            {/* import preview */}
            {importResult && (
              <div style={{ marginTop: 14, padding: 14, border: "1px solid #eee", borderRadius: 14 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>
                  Предпросмотр импорта
                </div>

                <div style={{ marginTop: 8, fontSize: 13, color: "#444" }}>
                  найдено: <b>{importResult.items.length}</b> · источник: <b>{importResult.detectedSource}</b> · тип:{" "}
                  <b>{importResult.detectedType}</b> · уверенность: <b>{Math.round((importResult.confidence ?? 0) * 100)}%</b>
                </div>

                {importResult.warnings?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
                    {importResult.warnings.join(" · ")}
                  </div>
                )}

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {importResult.items.slice(0, 40).map((it, idx) => (
                    <label
                      key={idx}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        padding: 12,
                        border: "1px solid #eee",
                        borderRadius: 12,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!selected[idx]}
                        onChange={(e) => setSelected((p) => ({ ...p, [idx]: e.target.checked }))}
                        style={{ marginTop: 3 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900 }}>{it.title}</div>
                        {it.creator && <div style={{ marginTop: 4, color: "#444" }}>{it.creator}</div>}
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Tag>{typeLabel(it.type)}</Tag>
                          <Tag>{it.source}</Tag>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  <ActionButton
                    label={savingImport ? "сохраняю…" : "сохранить выбранное в библиотеку"}
                    variant="primary"
                    disabled={savingImport}
                    onClick={saveImportedItems}
                  />
                </div>

                {savingImportError && (
                  <div style={{ marginTop: 10, color: "crimson", fontSize: 14 }}>
                    {savingImportError}
                  </div>
                )}
              </div>
            )}

            {/* manual add (как было) */}
            <div style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
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

            {saveError && (
              <div style={{ marginTop: 12, color: "crimson", fontSize: 14 }}>
                {saveError}
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <ActionButton
                label={saving ? "добавляю…" : "добавить в библиотеку"}
                variant="primary"
                disabled={!canSaveManual || saving}
                onClick={addItemManual}
              />
            </div>
          </>
        )}

        {/* LIBRARY */}
        {tab === "library" && (
          <>
            <div style={{ marginTop: 12, fontSize: 15, color: "#444" }}>
              всего в библиотеке: <b>{counts.total}</b> · музыка: <b>{counts.music}</b> · книги: <b>{counts.books}</b> · фильмы:{" "}
              <b>{counts.movies}</b>
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
                  <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.2 }}>
                    {it.title}
                  </div>

                  {it.creator && (
                    <div style={{ marginTop: 6, fontSize: 14, color: "#444" }}>
                      {it.creator}
                    </div>
                  )}

                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Tag>{typeLabel(it.type)}</Tag>
                    <Tag>{(it.source ?? "manual") as any}</Tag>
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

            {summaryError && (
              <div style={{ marginTop: 12, color: "crimson", fontSize: 14 }}>
                {summaryError}
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

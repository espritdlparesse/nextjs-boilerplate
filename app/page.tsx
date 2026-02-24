"use client";

import { useEffect, useState } from "react";

type ImportedItem = {
  type: "music" | "book" | "movie";
  source: "spotify" | "goodreads" | "letterboxd" | "manual";
  title: string;
  creator?: string | null;
};

export default function Page() {
  const [imported, setImported] = useState<ImportedItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    tg?.expand();
  }, []);

  const tgInitData =
    (typeof window !== "undefined" &&
      (window as any).Telegram?.WebApp?.initData) ||
    "";

  async function handleImport(file: File) {
    setError(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(
        `${window.location.origin}/api/import-image`,
        {
          method: "POST",
          headers: {
            "x-telegram-init-data": tgInitData,
          },
          body: form,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }

      setImported(data.items || []);
      setSelected(new Set((data.items || []).map((_: any, i: number) => i)));
    } catch (e: any) {
      setError(e.message || "Import error");
    }
  }

  async function saveSelected(items: ImportedItem[]) {
    setSaving(true);
    setError(null);

    try {
      for (const item of items) {
        const res = await fetch(
          `${window.location.origin}/api/items`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-telegram-init-data": tgInitData,
            },
            body: JSON.stringify({
              type: item.type,
              source: item.source,
              title: item.title,
              creator: item.creator,
            }),
          }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Save failed");
        }
      }

      setImported([]);
      setSelected(new Set());
    } catch (e: any) {
      setError(e.message || "Save error");
    } finally {
      setSaving(false);
    }
  }

  function toggle(index: number) {
    const copy = new Set(selected);
    if (copy.has(index)) copy.delete(index);
    else copy.add(index);
    setSelected(copy);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>add content</h1>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImport(file);
        }}
      />

      {error && (
        <div style={{ color: "red", marginTop: 12 }}>{error}</div>
      )}

      {imported.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {imported.map((item, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #ddd",
                padding: 12,
                borderRadius: 12,
                marginBottom: 12,
              }}
            >
              <label style={{ display: "flex", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {item.title}
                  </div>
                  {item.creator && (
                    <div style={{ opacity: 0.6 }}>
                      {item.creator}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        padding: "4px 8px",
                        background: "#eee",
                        borderRadius: 20,
                      }}
                    >
                      {item.type}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        padding: "4px 8px",
                        background: "#eee",
                        borderRadius: 20,
                      }}
                    >
                      {item.source}
                    </span>
                  </div>
                </div>
              </label>
            </div>
          ))}

          <button
            disabled={saving}
            onClick={() =>
              saveSelected(
                imported.filter((_, i) => selected.has(i))
              )
            }
            style={{
              width: "100%",
              padding: 14,
              background: "black",
              color: "white",
              borderRadius: 14,
              fontWeight: 600,
            }}
          >
            {saving
              ? "сохраняем..."
              : "сохранить выбранное в библиотеку"}
          </button>
        </div>
      )}
    </div>
  );
}

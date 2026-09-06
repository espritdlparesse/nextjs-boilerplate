import { useState } from "react";
import type { DbItem, ItemType } from "@/app/types";
import { apiFetch, getTgInitData, safeJson } from "@/app/apiFetch";
import { useAnimatedPlaceholder } from "@/app/hooks/useAnimatedPlaceholder";

type CustomCategory = { id: string; name: string; emoji: string };

export function useAddForm(deps: { items: DbItem[]; loadLibrary: () => void }) {
  const { items, loadLibrary } = deps;
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("📌");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  async function loadCustomCategories() {
    try {
      const { res, json } = await apiFetch("/api/custom-categories");
      if (res.ok) setCustomCategories(json?.categories ?? []);
    } catch {}
  }

  async function createCustomCategory() {
    if (!newCatName.trim()) return;
    setCatSaving(true); setCatError("");
    try {
      const { res, json } = await apiFetch("/api/custom-categories", { method: "POST", body: JSON.stringify({ name: newCatName.trim(), emoji: newCatEmoji }) });
      if (!res.ok) { setCatError(json?.error ?? "ошибка"); return; }
      await loadCustomCategories();
      setSelectedCatId(json?.category?.id ?? null);
      setNewCatName(""); setNewCatEmoji("📌");
      setShowCreateCategory(false);
    } catch (e: any) { setCatError(e?.message); }
    finally { setCatSaving(false); }
  }

  const [manualMode, setManualMode] = useState(false);
  const [manualType, setManualType] = useState<ItemType>("book");
  const titlePlaceholder = useAnimatedPlaceholder(manualType, "title");
  const creatorPlaceholder = useAnimatedPlaceholder(manualType, "creator");
  const [manualTitle, setManualTitle] = useState("");
  const [manualCreator, setManualCreator] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState(false);

  async function saveManual() {
    if (!manualTitle.trim()) { setManualError("Введи название"); return; }
    if (manualType === "custom" && !selectedCatId) { setManualError("Выбери категорию"); return; }
    setManualSaving(true); setManualError(""); setManualSuccess(false);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-init-data": getTgInitData(),
        },
        body: JSON.stringify({
          type: manualType,
          source: "manual",
          title: manualTitle.trim(),
          creator: manualCreator.trim() || null,
          ...(manualType === "custom" && selectedCatId ? { custom_category_id: selectedCatId } : {}),
        }),
      });
      const json = await safeJson(res);
      if (!res.ok) { setManualError(json?.error ?? "Ошибка"); return; }
      setManualTitle(""); setManualCreator(""); setManualSuccess(true);
      await loadLibrary();
      setTimeout(() => setManualSuccess(false), 2000);
    } catch (e: any) {
      setManualError(e?.message ?? "Ошибка");
    } finally {
      setManualSaving(false);
    }
  }

  return {
    customCategories, showCreateCategory, newCatName, newCatEmoji, catSaving, catError, selectedCatId,
    setShowCreateCategory, setNewCatName, setNewCatEmoji, setCatError, setSelectedCatId,
    loadCustomCategories, createCustomCategory,
    manualMode, manualType, titlePlaceholder, creatorPlaceholder, manualTitle, manualCreator,
    manualSaving, manualError, manualSuccess,
    setManualMode, setManualType, setManualTitle, setManualCreator, saveManual,
  };
}

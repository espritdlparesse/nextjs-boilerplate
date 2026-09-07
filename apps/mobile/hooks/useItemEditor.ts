import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { createItem, deleteItem, updateItem } from "../lib/api";
import { clampText, uid, type ContentType, type LibraryItem, type SourceType, type Tab } from "../shared/everyyou/domain";
import type { SyncStatus } from "./appTypes";

export function useItemEditor(deps: {
  apiToken: string | null;
  library: LibraryItem[];
  setLibrary: Dispatch<SetStateAction<LibraryItem[]>>;
  setSyncStatus: (status: SyncStatus) => void;
  setSyncMessage: (message: string) => void;
  setToastMessage: (message: string | null) => void;
  setTab: (tab: Tab) => void;
  fireAnalytics: (event: string, properties?: Record<string, unknown>) => void;
  clearSpotifyUrl: () => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}) {
  const { apiToken, library, setLibrary, setSyncStatus, setSyncMessage, setToastMessage, setTab, fireAnalytics, clearSpotifyUrl, selectedId, setSelectedId } = deps;
  const [type, setType] = useState<ContentType | "">("");
  const [source, setSource] = useState<SourceType | "">("");
  const [title, setTitle] = useState("");
  const [authorOrArtist, setAuthorOrArtist] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const canSave = useMemo(() => Boolean(type && clampText(title) && clampText(authorOrArtist)), [authorOrArtist, title, type]);

  function resetForm() {
    setType("");
    setSource("");
    setTitle("");
    setAuthorOrArtist("");
    clearSpotifyUrl();
  }

  async function addItem() {
    if (!canSave) return;
    const draft: LibraryItem = {
      id: uid(),
      type: type as ContentType,
      source: (source || "manual") as SourceType,
      title: clampText(title).toLowerCase(),
      authorOrArtist: clampText(authorOrArtist).toLowerCase(),
      createdAt: Date.now(),
      consumedAt: Date.now(),
      timeOrigin: "exact",
    };

    if (apiToken) {
      try {
        setSyncStatus("syncing");
        const saved = await createItem(apiToken, draft);
        setLibrary((current) => [saved, ...current]);
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
        resetForm();
        setTab("library");
        setSelectedId(saved.id);
        setToastMessage("добавили в библиотеку");
        fireAnalytics("item_created", { type: saved.type, source: saved.source, mode: "manual" });
        return;
      } catch {
        setLibrary((current) => [draft, ...current]);
        setSyncStatus("offline");
        setSyncMessage("не удалось сохранить на сервер, айтем добавлен локально");
        setToastMessage("сохранили локально");
      }
    } else {
      setLibrary((current) => [draft, ...current]);
      setToastMessage("добавили в библиотеку");
    }

    fireAnalytics("item_created", { type: draft.type, source: draft.source, mode: "manual_local" });

    resetForm();
    setTab("library");
    setSelectedId(draft.id);
  }

  function startEdit(id: string) {
    const item = library.find((entry) => entry.id === id);
    if (!item) return;
    setEditingId(id);
    setType(item.type);
    setSource(item.source);
    setTitle(item.title);
    setAuthorOrArtist(item.authorOrArtist);
    setTab("add");
  }

  async function saveEdit() {
    if (!editingId || !canSave) return;

    const updatedDraft = {
      id: editingId,
      type: type as ContentType,
      source: (source || "manual") as SourceType,
      title: clampText(title).toLowerCase(),
      authorOrArtist: clampText(authorOrArtist).toLowerCase(),
      consumedAt:
        library.find((item) => item.id === editingId)?.consumedAt ??
        ((source || "manual") === "manual" ? Date.now() : undefined),
      timeOrigin:
        library.find((item) => item.id === editingId)?.timeOrigin ??
        ((source || "manual") === "manual" ? "exact" : undefined),
    };

    if (apiToken) {
      try {
        setSyncStatus("syncing");
        const saved = await updateItem(apiToken, updatedDraft);
        setLibrary((current) => current.map((item) => (item.id === editingId ? saved : item)));
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
        setToastMessage("сохранили изменения");
        fireAnalytics("item_updated", { type: saved.type, source: saved.source });
      } catch {
        setLibrary((current) =>
          current.map((item) => (item.id === editingId ? { ...item, ...updatedDraft } : item))
        );
        setSyncStatus("offline");
        setSyncMessage("не удалось обновить сервер, изменения сохранены локально");
        setToastMessage("обновили локально");
      }
    } else {
      setLibrary((current) =>
        current.map((item) => (item.id === editingId ? { ...item, ...updatedDraft } : item))
      );
      setToastMessage("сохранили изменения");
      fireAnalytics("item_updated", { type: updatedDraft.type, source: updatedDraft.source, mode: "local" });
    }

    setSelectedId(editingId);
    setEditingId(null);
    resetForm();
    setTab("library");
  }

  async function removeItem(id: string) {
    if (apiToken) {
      try {
        setSyncStatus("syncing");
        await deleteItem(apiToken, id);
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
      } catch {
        setSyncStatus("offline");
        setSyncMessage("не удалось удалить на сервере, айтем убран локально");
      }
    }

    setLibrary((current) => current.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
    setToastMessage("удалили из библиотеки");
    fireAnalytics("item_deleted");
  }

  return {
    type, source, title, authorOrArtist, editingId, canSave,
    setType, setSource, setTitle, setAuthorOrArtist, setEditingId,
    resetForm, addItem, startEdit, saveEdit, removeItem,
  };
}

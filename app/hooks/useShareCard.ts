import { useEffect, useState } from "react";
import { generateShareCard } from "@/lib/shareCard";
import { telegramWebApp } from "@/lib/telegramWebApp";
import type { DbItem } from "@/app/types";
import { useVibecheck } from "@/app/hooks/useVibecheck";

export function useShareCard(deps: { items: DbItem[]; vibe: ReturnType<typeof useVibecheck> }) {
  const { items, vibe } = deps;
  const [showShareCard, setShowShareCard] = useState(false);
  const [shareCardDataUrl, setShareCardDataUrl] = useState<string | null>(null);
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [sharePickerSelected, setSharePickerSelected] = useState<Set<string | number>>(new Set());
  const [sharePickerText, setSharePickerText] = useState<string | undefined>(undefined);
  const [sharePickerType, setSharePickerType] = useState<"vibe" | "deep" | undefined>(undefined);

  useEffect(() => {
    const tg = telegramWebApp();
    const subscribe = tg?.onEvent;
    const unsubscribe = tg?.offEvent;
    if (!subscribe || !unsubscribe) return;
    const handler = async () => {
      setShareCardDataUrl(await generateShareCard(items));
      setShowShareCard(true);
    };
    subscribe("screenshot_taken", handler);
    return () => unsubscribe("screenshot_taken", handler);
  }, [items]);

  function openSharePicker(text?: string, type?: "vibe" | "deep") {
    setSharePickerText(text);
    setSharePickerType(type);
    vibe.setShareRunId(type === "vibe" ? vibe.vibeRunId : null);
    // По умолчанию выбираем все айтемы
    setSharePickerSelected(new Set(items.map(i => i.id)));
    setShowSharePicker(true);
  }

  async function shareVibeCard(text: string, type: "vibe" | "deep") {
    openSharePicker(text, type);
  }

  return {
    showShareCard, shareCardDataUrl, showSharePicker, sharePickerSelected, sharePickerText, sharePickerType,
    setShowShareCard, setShareCardDataUrl, setShowSharePicker, setSharePickerSelected,
    openSharePicker, shareVibeCard,
  };
}

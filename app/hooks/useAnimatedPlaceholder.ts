import { useEffect, useState } from "react";
import type { ItemType } from "@/app/types";

const PLACEHOLDER_EXAMPLES: Record<ItemType, { title: string; creator: string }[]> = {
  movie: [
    { title: "Трудности перевода", creator: "София Коппола" },
    { title: "Крёстный отец", creator: "Фрэнсис Форд Коппола" },
    { title: "Мария", creator: "Пабло Ларраин" },
  ],
  music: [
    { title: "Bloodbuzz Ohio", creator: "The National" },
    { title: "Apartment Story", creator: "The National" },
    { title: "Sorrow", creator: "The National" },
  ],
  book: [
    { title: "Котлован", creator: "Андрей Платонов" },
    { title: "Чевенгур", creator: "Андрей Платонов" },
    { title: "Счастливая Москва", creator: "Андрей Платонов" },
  ],
  custom: [
    { title: "название", creator: "автор / бренд" },
  ],
};

const TYPING_MS = 55;
const FULL_PAUSE_MS = 1800;
const BEFORE_ERASE_MS = 400;
const ERASING_MS = 28;

export function useAnimatedPlaceholder(type: ItemType, field: "title" | "creator") {
  const examples = PLACEHOLDER_EXAMPLES[type];
  const [state, setState] = useState({ type, index: 0, shown: "", erasing: false });
  const current = state.type === type ? state : { type, index: 0, shown: "", erasing: false };
  const target = examples[current.index % examples.length][field];

  useEffect(() => {
    const next = (patch: Partial<typeof current>) => setState({ ...current, ...patch });

    if (!current.erasing && current.shown.length < target.length) {
      const timeout = setTimeout(() => next({ shown: target.slice(0, current.shown.length + 1) }), TYPING_MS);
      return () => clearTimeout(timeout);
    }
    if (!current.erasing) {
      const timeout = setTimeout(() => next({ erasing: true }), FULL_PAUSE_MS + BEFORE_ERASE_MS);
      return () => clearTimeout(timeout);
    }
    if (current.shown.length > 0) {
      const timeout = setTimeout(() => next({ shown: current.shown.slice(0, -1) }), ERASING_MS);
      return () => clearTimeout(timeout);
    }
    const timeout = setTimeout(
      () => next({ index: (current.index + 1) % examples.length, erasing: false }),
      TYPING_MS
    );
    return () => clearTimeout(timeout);
  });

  return current.shown;
}

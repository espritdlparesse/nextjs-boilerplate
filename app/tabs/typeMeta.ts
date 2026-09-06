import type { ItemType } from "@/app/types";

export const TYPE_LABELS: Record<ItemType, string> = {
  music: "музыка",
  book: "книга",
  movie: "фильм",
  custom: "своё",
};

export const TYPE_ICONS: Record<ItemType, string> = {
  music: "♪",
  book: "◻",
  movie: "◈",
  custom: "✦",
};

export const TYPE_COLORS: Record<ItemType, string> = {
  music: "#c8f0d8",
  book: "#fde8c8",
  movie: "#d8e8fd",
  custom: "#f0f0f0",
};

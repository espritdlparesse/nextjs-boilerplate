export const ITEM_TYPES = ["music", "book", "movie"] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

export function isItemType(value: string | null | undefined): value is ItemType {
  return ITEM_TYPES.includes(value as ItemType);
}

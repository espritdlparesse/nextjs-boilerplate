export const ITEM_TYPES = ["music", "book", "movie", "custom"] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

export function isItemType(value: string | null | undefined): value is ItemType {
  return ITEM_TYPES.includes(value as ItemType);
}

export function countItemTypes(types: Array<string | null | undefined>) {
  const counts: Partial<Record<ItemType, number>> = {};
  for (const type of types) {
    if (isItemType(type)) counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

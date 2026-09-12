import { clampText } from "./text.ts";

export type IdentifiableItem = {
  type: string;
  title: string;
  creator?: string | null;
};

export function itemIdentityKey(item: IdentifiableItem) {
  const title = clampText(item.title).toLowerCase();
  const creator = clampText(item.creator ?? "").toLowerCase();
  return `${item.type}${title}${creator}`;
}

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isUsableCard } from "@/lib/culturalCards";
import type { ItemType } from "@/lib/mediaTypes";

export type CulturalContextRow = {
  lookup_key: string;
  aliases: string[];
  display_name: string;
  kind: "artist" | "author" | "director" | "work";
  context_note: string;
  roast_angles: string[];
  source_outlet: CulturalSourceOutlet;
  source_url: string;
};

type CulturalSourceOutlet =
  | "the_atlantic"
  | "new_yorker"
  | "nyt"
  | "meduza"
  | "the_bell"
  | "kinopoisk"
  | "wos"
  | "afisha_archive"
  | "x_ilya_krasilshchik"
  | "facebook_ilya_krasilshchik"
  | "wonderzine";

const VIBE_SAMPLE_TYPES: ItemType[] = ["music", "book", "movie"];

export function buildContextIndex(cards: CulturalContextRow[] | null) {
  const index = new Map<string, CulturalContextRow>();
  for (const card of cards ?? []) {
    for (const alias of [card.lookup_key, ...(card.aliases ?? [])]) {
      const key = normalizeContextKey(alias);
      if (key) index.set(key, card);
    }
  }
  return index;
}

export function findCard(text: string, index: Map<string, CulturalContextRow>) {
  const normalized = normalizeContextKey(text);
  if (!normalized) return null;
  const direct = index.get(normalized);
  if (direct) return direct;
  for (const [key, card] of index) {
    if (key.length >= 4 && normalized.includes(key)) return card;
  }
  return null;
}

export function describePosition(position: string, index: Map<string, CulturalContextRow>) {
  const card = findCard(position, index);
  if (!card) return `- ${position}`;
  const angles = card.roast_angles.length > 0 ? ` Опоры: ${card.roast_angles.join("; ")}.` : "";
  return `- ${position}\n    ${card.context_note}${angles}`;
}

export function describeItem(
  item: { type: string; title: string; creator: string | null },
  index: Map<string, CulturalContextRow>
) {
  const line = `[${item.type}] ${item.title}${item.creator ? ` — ${item.creator}` : ""}`;
  const card = findCard(`${item.creator ?? ""} ${item.title}`, index);
  if (!card) return line;
  const angles = card.roast_angles.length > 0 ? ` Опоры: ${card.roast_angles.join("; ")}.` : "";
  return `${line}\n    ${card.context_note}${angles}`;
}

export function buildVibeSample(items: Array<{ type: string; title: string; creator: string | null }>) {
  const picked: Array<{ type: string; title: string; creator: string | null }> = [];
  const usedCreators = new Set<string>();
  const daySeed = new Date().toISOString().slice(0, 10);

  function score(item: { type: string; title: string; creator: string | null }) {
    const value = `${daySeed}:${item.type}:${item.title}:${item.creator ?? ""}`;
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) | 0;
    }
    return hash >>> 0;
  }

  for (const type of VIBE_SAMPLE_TYPES) {
    const candidates = items
      .filter((item) => item.type === type)
      .sort((left, right) => score(left) - score(right));
    for (const item of candidates) {
      if (picked.length >= 32) continue;
      const creator = item.creator?.trim().toLowerCase() ?? "";
      if (creator && usedCreators.has(creator)) continue;
      picked.push(item);
      if (creator) usedCreators.add(creator);
      if (picked.filter((candidate) => candidate.type === type).length >= 8) break;
    }
  }

  return picked.length > 0 ? picked : items.slice(0, 48);
}

export function normalizeContextKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[«»"'`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export async function getCulturalContext(
  sb: ReturnType<typeof supabaseAdmin>,
  items: Array<{ title: string; creator: string | null }>
) {
  const keys = new Set(
    items.flatMap((item) => [item.title, item.creator ?? ""])
      .map(normalizeContextKey)
      .filter(Boolean)
  );

  if (keys.size === 0) return [] as CulturalContextRow[];

  const { data, error } = await sb
    .from("cultural_context")
    .select("lookup_key, aliases, display_name, kind, context_note, roast_angles, source_outlet, source_url")
    .limit(400);

  // The migration may not have reached a project yet. A missing memory must not block a vibecheck.
  if (error || !data) return null;

  return (data as CulturalContextRow[]).filter((entry) => {
    if (!isUsableCard(entry)) return false;
    const aliases = [entry.lookup_key, ...(entry.aliases ?? [])].map(normalizeContextKey);
    return aliases.some((alias) => keys.has(alias));
  });
}

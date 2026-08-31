import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const ownerKey = process.env.CULTURAL_OWNER_KEY ?? process.argv[2];
const limit = Number(process.env.CULTURAL_OWNER_KEY ? process.argv[2] ?? "0" : process.argv[3] ?? "0");

if (!ownerKey || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_API_KEY) {
  throw new Error("Usage: node scripts/warm-cultural-context.mjs <owner-key> [max-batches]");
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

const hosts = {
  the_atlantic: ["theatlantic.com"],
  new_yorker: ["newyorker.com"],
  nyt: ["nytimes.com", "nyt.com"],
  meduza: ["meduza.io"],
  the_bell: ["thebell.io"],
  kinopoisk: ["kinopoisk.ru"],
  wos: ["w-o-s.ru"],
  afisha_archive: ["afisha.ru"],
  x_ilya_krasilshchik: ["x.com", "twitter.com"],
  facebook_ilya_krasilshchik: ["facebook.com"],
  wonderzine: ["wonderzine.com"],
};

function key(value) {
  return value.toLowerCase().replace(/[«»"'`]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function allowed(url, outlet, publishedAt) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (!hosts[outlet]?.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) return false;
    return outlet !== "afisha_archive" || Boolean(publishedAt) && new Date(`${publishedAt}T00:00:00Z`) < new Date("2021-01-01T00:00:00Z");
  } catch {
    return false;
  }
}

function normalizePublishedAt(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "")) ? value : null;
}

async function allItems() {
  const items = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("items")
      .select("title, creator")
      .eq("owner_key", ownerKey)
      .range(from, from + 999);
    if (error) throw error;
    items.push(...data);
    if (data.length < 1000) return items;
  }
}

const items = await allItems();
const { data: existing, error: contextError } = await supabase
  .from("cultural_context")
  .select("lookup_key, aliases");
if (contextError) throw contextError;

const known = new Set((existing ?? []).flatMap((row) => [row.lookup_key, ...(row.aliases ?? [])]).map(key));
const creatorCounts = new Map();
for (const item of items) {
  const creator = key(item.creator ?? "");
  if (creator.length >= 3) creatorCounts.set(creator, (creatorCounts.get(creator) ?? 0) + 1);
}
const candidates = Array.from(creatorCounts.entries())
  .filter(([creator]) => !known.has(creator))
  .sort((left, right) => right[1] - left[1])
  .map(([creator]) => creator);
const batches = Array.from({ length: Math.ceil(candidates.length / 8) }, (_, index) => candidates.slice(index * 8, index * 8 + 8));
const targetBatches = limit > 0 ? batches.slice(0, limit) : batches;

console.log(`items=${items.length} candidates=${candidates.length} batches=${targetBatches.length}`);

for (const [index, batch] of targetBatches.entries()) {
  const response = await openai.responses.create({
    model,
    max_output_tokens: 1800,
    tools: [{ type: "web_search_preview", search_context_size: "high" }],
    instructions: "For each supplied cultural name, find one reliable context source ONLY in The Atlantic, The New Yorker, The New York Times, Meduza, The Bell, Kinopoisk, WOS, Afisha published before 2021-01-01, Ilya Krasilshchik's own X/Facebook posts, or Wonderzine. Return JSON only: {cards:[{lookup_key,aliases,display_name,kind,context_note,roast_angles,source_outlet,source_url,source_published_at}]}. Never invent links. Omit a card when no qualifying source exists. context_note must be a 1-2 sentence factual paraphrase, not a review. roast_angles are short factual tension cues, not jokes. source_outlet must be one of the approved keys. kind is artist, author, director, or work.",
    input: batch.map((value) => `Find context for: ${value}`).join("\n"),
  });

  const raw = response.output_text ?? "";
  if (process.env.CULTURAL_CONTEXT_DEBUG === "1") console.log(raw);
  const match = raw.match(/\{[\s\S]*\}/);
  let parsed = { cards: [] };
  try {
    parsed = match ? JSON.parse(match[0]) : parsed;
  } catch {
    console.warn(`batch ${index + 1}/${targetBatches.length}: invalid JSON, skipped`);
    continue;
  }
  const rows = (parsed.cards ?? []).map((card) => {
    const lookupKey = key(card.lookup_key ?? card.display_name ?? "");
    const outlet = String(card.source_outlet ?? "").trim().toLowerCase().replace(/\s+/g, "_");
    const publishedAt = normalizePublishedAt(card.source_published_at);
    if (!lookupKey || !card.display_name || !card.context_note || !allowed(card.source_url, outlet, publishedAt)) return null;
    return {
      lookup_key: lookupKey,
      aliases: Array.from(new Set([...(card.aliases ?? []), card.display_name])).map(key).filter(Boolean),
      display_name: card.display_name.trim(),
      kind: ["artist", "author", "director", "work"].includes(card.kind) ? card.kind : "work",
      context_note: card.context_note.trim().slice(0, 420),
      roast_angles: (card.roast_angles ?? []).map((angle) => String(angle).trim()).filter(Boolean).slice(0, 2),
      source_outlet: outlet,
      source_url: card.source_url,
      source_published_at: publishedAt,
    };
  }).filter(Boolean);

  if (rows.length) {
    const { error } = await supabase.from("cultural_context").upsert(rows, { onConflict: "lookup_key" });
    if (error) throw error;
  }
  console.log(`batch ${index + 1}/${targetBatches.length}: saved=${rows.length}`);
}

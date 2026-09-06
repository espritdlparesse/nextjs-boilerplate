import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import { cardFlaws, isUsableCard } from "../lib/culturalCards.ts";

const ownerKey = process.env.CULTURAL_OWNER_KEY ?? null;
const skipAttempted = !process.argv.includes("--redo");
const limit = Number(process.argv.find((arg) => /^\d+$/.test(arg)) ?? "0");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_API_KEY) {
  throw new Error("Usage: node scripts/warm-cultural-context.mjs [max-batches] [--redo]. Set CULTURAL_OWNER_KEY to limit to one library.");
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const progressPath = new URL("./.cultural-context-progress.json", import.meta.url);

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
    let query = supabase.from("items").select("title, creator").range(from, from + 999);
    if (ownerKey) query = query.eq("owner_key", ownerKey);
    const { data, error } = await query;
    if (error) throw error;
    items.push(...data);
    if (data.length < 1000) return items;
  }
}

async function readProgress() {
  try {
    return JSON.parse(await readFile(progressPath, "utf8"));
  } catch {
    return {};
  }
}

async function saveProgress(progress) {
  await writeFile(progressPath, `${JSON.stringify(progress, null, 2)}\n`);
}

const items = await allItems();
const { data: existing, error: contextError } = await supabase
  .from("cultural_context")
  .select("lookup_key, aliases, context_note, roast_angles");
if (contextError) throw contextError;

const usable = (existing ?? []).filter(isUsableCard);
const known = new Set(usable.flatMap((row) => [row.lookup_key, ...(row.aliases ?? [])]).map(key));
console.log(`карточек ${existing?.length ?? 0}, годных ${usable.length} — негодные будут переписаны`);
const progress = await readProgress();
const progressKey = ownerKey ?? "all";
const attempted = new Set(progress[progressKey] ?? []);
const creatorCounts = new Map();
for (const item of items) {
  const creator = key(item.creator ?? "");
  if (creator.length >= 3) creatorCounts.set(creator, (creatorCounts.get(creator) ?? 0) + 1);
}
const candidates = Array.from(creatorCounts.entries())
  .filter(([creator]) => !known.has(creator) && !(skipAttempted && attempted.has(creator)))
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
    instructions: "For each supplied cultural name, find one reliable context source ONLY in The Atlantic, The New Yorker, The New York Times, Meduza, The Bell, Kinopoisk, WOS, Afisha published before 2021-01-01, Ilya Krasilshchik's own X/Facebook posts, or Wonderzine. Return JSON only: {cards:[{lookup_key,aliases,display_name,kind,context_note,roast_angles,source_outlet,source_url,source_published_at}]}. Never invent links. Omit a card when no qualifying source exists. Write context_note in Russian: 1-2 sentences naming what this artist or work is recognisably like — the scene it belongs to, the pose it strikes, the texture a listener or reader would recognise. Do NOT write a news item: no dates, no releases, no awards, no what-happened-in-a-given-year. Do NOT write praise: never say known for, unique, emotional, iconic, legendary, outstanding, popular, talented. Do NOT write a biography or an assessment. Test every note by deleting the name: if it would fit any other artist of the same kind, the note is useless — rewrite it or omit the card. Good: a Russian rapper whose breakthrough was Dragonborn: heavy bass, trap, game references and deliberately slurred delivery. Bad: an American rapper and producer known for his provocative statements. roast_angles are 1-2 short concrete tensions this material could collide with, not jokes and not compliments. source_outlet must be one of the approved keys. kind is artist, author, director, or work.",
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
    const angles = (card.roast_angles ?? []).map((angle) => String(angle).trim()).filter(Boolean).slice(0, 2);
    const note = card.context_note.trim().slice(0, 420);
    const flaws = cardFlaws({ context_note: note, roast_angles: angles });
    if (flaws.length > 0) {
      console.warn(`  отброшено ${card.display_name}: ${flaws.join(", ")}`);
      return null;
    }
    return {
      lookup_key: lookupKey,
      aliases: Array.from(new Set([...(card.aliases ?? []), card.display_name])).map(key).filter(Boolean),
      display_name: card.display_name.trim(),
      kind: ["artist", "author", "director", "work"].includes(card.kind) ? card.kind : "work",
      context_note: note,
      roast_angles: angles,
      source_outlet: outlet,
      source_url: card.source_url,
      source_published_at: publishedAt,
    };
  }).filter(Boolean);

  if (rows.length) {
    const { error } = await supabase.from("cultural_context").upsert(rows, { onConflict: "lookup_key" });
    if (error) throw error;
  }
  for (const creator of batch) attempted.add(creator);
  progress[progressKey] = Array.from(attempted);
  await saveProgress(progress);
  console.log(`batch ${index + 1}/${targetBatches.length}: saved=${rows.length}`);
}

import { hashSeed, mulberry32 } from "@/lib/seededRandom";
import { topEntry } from "@/lib/topEntry";

export type VibecheckItem = {
  type: string;
  title: string;
  creator: string | null;
};

export type VibecheckFallbackResult = {
  itemCount: number;
  persona: string;
  summary: string;
  basis: string[];
  highlights: string[];
};

function format(item: VibecheckItem) {
  return item.creator ? `${item.title} — ${item.creator}` : item.title;
}

function capitalize(s: string) {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

function shuffleDeterministic(items: VibecheckItem[], seed: number) {
  return items
    .map((item, index) => ({ item, score: mulberry32(seed + index * 7919)() }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.item);
}

function pickPair(items: VibecheckItem[], seed: number): [VibecheckItem, VibecheckItem] | null {
  const shuffled = shuffleDeterministic(items, seed);

  for (let i = 0; i < shuffled.length; i++) {
    for (let j = i + 1; j < shuffled.length; j++) {
      if (shuffled[i].type !== shuffled[j].type) return [shuffled[i], shuffled[j]];
    }
  }

  for (let i = 0; i < shuffled.length; i++) {
    for (let j = i + 1; j < shuffled.length; j++) {
      const c1 = shuffled[i].creator?.trim().toLowerCase() ?? "";
      const c2 = shuffled[j].creator?.trim().toLowerCase() ?? "";
      if (c1 !== c2) return [shuffled[i], shuffled[j]];
    }
  }

  return shuffled.length >= 2 ? [shuffled[0], shuffled[1]] : null;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

const PERSONA_BY_TYPE: Record<string, string> = {
  music: "меломан",
  book: "книжный человек",
  movie: "киноман",
};

function computePersona(items: VibecheckItem[], rng: () => number) {
  const byType = new Map<string, number>();
  for (const item of items) byType.set(item.type, (byType.get(item.type) ?? 0) + 1);

  if (byType.size >= 3) {
    return pick(rng, ["человек с широким диапазоном", "коллекционер разного", "смотрит во все стороны сразу"]);
  }

  const { type: dominantType, count: dominantCount } = topEntry(byType, items[0]?.type ?? "music");

  const share = items.length > 0 ? dominantCount / items.length : 0;
  if (share >= 0.7) return PERSONA_BY_TYPE[dominantType] ?? "человек с чётким фокусом";
  return "человек с разносторонним вкусом";
}

export function generateFallbackVibecheck(items: VibecheckItem[]): VibecheckFallbackResult | null {
  if (items.length === 0) return null;

  const seed = hashSeed(
    `${Math.random()}|${Date.now()}|${items.map((i) => `${i.type}|${i.title}|${i.creator ?? ""}`).join("~")}`
  );
  const rng = mulberry32(seed);
  const persona = computePersona(items, rng);

  const pair = pickPair(items, seed);

  if (!pair) {
    const only = items[0];
    return {
      itemCount: items.length,
      persona,
      summary: `Пока в библиотеке только «${format(only)}» — маловато для сравнений, но начало есть.`,
      basis: [format(only)],
      highlights: [],
    };
  }

  const [a, b] = pair;
  const connector = pick(rng, [
    `${capitalize(format(a))} и ${format(b)}.`,
    `${capitalize(format(a))} и ${format(b)}?`,
    `Вот пара: ${format(a)} и ${format(b)}.`,
  ]);
  const observation = pick(rng, [
    "кажется, кому-то пора помыться и найти работу.",
    "круто, что мужская депрессия бывает не только у мужчин.",
    "судя по тому, что я вижу, ты на грани истерики — не знаю только, в хорошем или плохом смысле.",
    "сразу видно, что этот пользователь любит, когда ему плохо.",
    "идеально для случаев, когда хочется, чтобы стало полегче.",
    "всё слишком нормально, наверное тебя в детстве очень любили родители.",
    "очень необычно, зайка, надеюсь человек, кому ты хочешь что-то доказать, это заметит.",
    "ничего страшного!",
    "а впрочем неважно. хорошего дня!",
    "даже не знаю что сказать... мне нужно побыть в одиночестве после всего, что я тут видел.",
    "слушай, а точно всё нормально?",
    "мама бы не одобрила, а папа бы посмеялся.",
  ]);

  return {
    itemCount: items.length,
    persona,
    summary: `${connector} ${observation}`,
    basis: [format(a), format(b)],
    highlights: [],
  };
}

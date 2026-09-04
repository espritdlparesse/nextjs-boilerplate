// Fallback для /api/v2/analysis (живой вайбчек) на случай, когда GPT
// недоступен: кончились кредиты OpenAI, таймаут, любая другая ошибка API.
//
// Это НЕ замена основному вайбчеку — тот остаётся приоритетным и делает
// куда более тонкую работу (ищет культурно значимые контрасты, ходит в
// вебсёрч, несколько раз перепроверяет тон). Это просто чтобы пользователь
// не упирался в голую ошибку, если основной путь недоступен: без вызовов
// ИИ находим два разных по типу айтема в библиотеке и собираем наблюдение
// из заготовленных фраз. Проще и грубее настоящего вайбчека, но живое.

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

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function format(item: VibecheckItem) {
  return item.creator ? `${item.title} — ${item.creator}` : item.title;
}

function capitalize(s: string) {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

// Сортируем детерминированно, но каждый день по-разному (сид завязан на
// дату), чтобы фича не отвечала одним и тем же одну и ту же неделю подряд.
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
  film: "киноман",
  movie: "киноман",
};

function computePersona(items: VibecheckItem[], rng: () => number) {
  const byType = new Map<string, number>();
  for (const item of items) byType.set(item.type, (byType.get(item.type) ?? 0) + 1);

  if (byType.size >= 3) {
    return pick(rng, ["человек с широким диапазоном", "коллекционер разного", "смотрит во все стороны сразу"]);
  }

  let dominantType = items[0]?.type ?? "music";
  let dominantCount = 0;
  for (const [type, count] of byType.entries()) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantType = type;
    }
  }

  const share = items.length > 0 ? dominantCount / items.length : 0;
  if (share >= 0.7) return PERSONA_BY_TYPE[dominantType] ?? "человек с чётким фокусом";
  return "человек с разносторонним вкусом";
}

export function generateFallbackVibecheck(items: VibecheckItem[]): VibecheckFallbackResult | null {
  if (items.length === 0) return null;

  const seed = hashSeed(
    `${new Date().toISOString().slice(0, 10)}|${items.map((i) => `${i.type}|${i.title}|${i.creator ?? ""}`).join("~")}`
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
    "Одно тянет в одну сторону, другое — в другую, и правда обычно где-то между ними.",
    "Разное настроение, разное время суток — но в одной библиотеке уживается нормально.",
    "Такое редко оказывается рядом, но, кажется, обе стороны сейчас нужны одновременно.",
    "Не самое очевидное соседство — но оно честнее, чем если бы ты выбрала что-то одно.",
    "Одно — про будни, другое — про побег от них. Комбинация рабочая.",
  ]);

  return {
    itemCount: items.length,
    persona,
    summary: `${connector} ${observation}`,
    basis: [format(a), format(b)],
    highlights: [],
  };
}

import { hashSeed, mulberry32 } from "@/lib/seededRandom";
import { topEntry } from "@/lib/topEntry";
// Rule-based "ментальный возраст" — без единого вызова ИИ.
//
// Логика та же, что у pudding.cool/judge-my-music: НИКАКОГО настоящего ИИ.
// Считаем несколько простых цифр по данным пользователя, подбираем
// подходящий банк заготовленных фраз под эти цифры, вставляем в шаблон
// реальные имена/тайтлы. Быстро, бесплатно, работает без лимитов.
//
// Результат детерминирован для одной и той же библиотеки (сид считается
// из самих данных) — это ощущается как "настоящий расчёт", а не рандом,
// но разные библиотеки дают разные ответы.

export type MentalAgeItem = {
  type: string; // "music" | "book" | "movie" | ...
  title: string;
  creator: string | null;
};

type Stats = {
  total: number;
  byType: Map<string, number>;
  dominantType: string;
  dominantShare: number;
  distinctTypes: number;
  topCreator: string | null;
  topCreatorCount: number;
  uniqueCreatorRatio: number;
  recent: MentalAgeItem | null;
};

// mulberry32 — маленький детерминированный PRNG без зависимостей.

function computeStats(items: MentalAgeItem[]): Stats {
  const byType = new Map<string, number>();
  const creatorCounts = new Map<string, number>();

  for (const item of items) {
    byType.set(item.type, (byType.get(item.type) ?? 0) + 1);
    const creator = item.creator?.trim().toLowerCase();
    if (creator) creatorCounts.set(creator, (creatorCounts.get(creator) ?? 0) + 1);
  }

  const { type: dominantType, count: dominantCount } = topEntry(byType, items[0]?.type ?? "music");

  const { type: topCreator, count: topCreatorCount } = topEntry(creatorCounts, "");

  const uniqueCreatorRatio = creatorCounts.size > 0 ? creatorCounts.size / items.length : 1;

  return {
    total: items.length,
    byType,
    dominantType,
    dominantShare: items.length > 0 ? dominantCount / items.length : 0,
    distinctTypes: byType.size,
    topCreator,
    topCreatorCount,
    uniqueCreatorRatio,
    recent: items[0] ?? null,
  };
}

const TYPE_FORMS: Record<string, { acc: string; plural: string; genPlural: string }> = {
  music: { acc: "трек", plural: "треки", genPlural: "треков" },
  book: { acc: "книгу", plural: "книги", genPlural: "книг" },
  movie: { acc: "фильм", plural: "фильмы", genPlural: "фильмов" },
};

function typeWord(type: string) {
  return TYPE_FORMS[type]?.acc ?? "штуку";
}

function typeWordPlural(type: string) {
  return TYPE_FORMS[type]?.plural ?? "штуки";
}

function typeWordGenPlural(type: string) {
  return TYPE_FORMS[type]?.genPlural ?? "штук";
}

function yearsWord(n: number) {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return "лет";
  if (mod10 === 1) return "год";
  if (mod10 >= 2 && mod10 <= 4) return "года";
  return "лет";
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function capitalize(s: string) {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

export function generateRuleBasedMentalAge(items: MentalAgeItem[]): string | null {
  // Слишком мало данных — не с чего строить уверенный вывод, пусть решает GPT-фолбэк.
  if (items.length < 3) return null;

  const stats = computeStats(items);
  const seed = hashSeed(items.map((i) => `${i.type}|${i.title}|${i.creator ?? ""}`).join("~"));
  const rng = mulberry32(seed);

  let age = 16 + Math.floor(rng() * 40); // базовый диапазон 16–55

  const isObsessive = stats.topCreatorCount >= 4 && stats.topCreatorCount / stats.total >= 0.2;
  const isRenaissance = stats.distinctTypes >= 3;
  const isMono = stats.distinctTypes === 1 && stats.total >= 5;
  const isEclectic = stats.uniqueCreatorRatio > 0.85 && stats.total >= 10;

  if (isObsessive) age -= 6;
  if (isRenaissance) age += 7;
  if (isMono) age -= 4;
  if (isEclectic) age += 5;
  age = Math.max(13, Math.min(78, age));

  const recentTitle = stats.recent?.title ?? "";
  const recentCreator = stats.recent?.creator ?? "";
  const recentType = stats.recent ? typeWord(stats.recent.type) : "штуку";
  const dominantPlural = typeWordPlural(stats.dominantType);
  const dominantGenPlural = typeWordGenPlural(stats.dominantType);

  let line: string;

  if (isObsessive && stats.topCreator) {
    line = pick(rng, [
      `${capitalize(stats.topCreator)} встречается у тебя ${stats.topCreatorCount} раз — либо это любовь, либо ты забыла, что уже добавляла.`,
      `${stats.topCreatorCount} позиций от ${stats.topCreator} подряд. Кто-то тут никуда не торопится.`,
      `Ты явно нашла своего человека — ${stats.topCreator}, ${stats.topCreatorCount} раз в библиотеке. Остальные могут пока постоять в сторонке.`,
    ]);
  } else if (isRenaissance) {
    line = pick(rng, [
      `Музыка, книги и фильмы в одной библиотеке — либо у тебя очень насмотренная жизнь, либо ты просто ничего не удаляешь.`,
      `Три разных типа контента сразу — это либо широкий вкус, либо неспособность выбрать что-то одно.`,
      `Держишь в одном месте и ${recentType}, и всё остальное — редкий случай, когда человек честно фиксирует всё подряд.`,
    ]);
  } else if (isMono && recentTitle) {
    line = pick(rng, [
      `Только ${dominantPlural}, ничего кроме. ${capitalize(recentTitle)}${recentCreator ? ` — ${recentCreator}` : ""} — последнее тому доказательство.`,
      `Ты явно нашла свой формат и больше никуда не смотришь: сплошные ${dominantPlural}, последнее — «${recentTitle}».`,
      `Библиотека из одних ${dominantGenPlural} — либо принцип, либо просто лень заводить другие категории.`,
    ]);
  } else if (isEclectic) {
    line = pick(rng, [
      `Почти ни один автор не повторяется — ты либо очень любопытна, либо не можешь остановиться на чём-то одном дольше одного раза.`,
      `Каждая позиция — новое имя. Последнее — «${recentTitle}»${recentCreator ? ` от ${recentCreator}` : ""}. Постоянство явно не про тебя.`,
      `Разброс имён огромный — похоже, тебе быстрее наскучивает, чем ты успеваешь привыкнуть.`,
    ]);
  } else if (recentTitle) {
    line = pick(rng, [
      `Последнее добавленное — «${recentTitle}»${recentCreator ? ` (${recentCreator})` : ""}. По этому одному штриху уже многое понятно.`,
      `Судя по «${recentTitle}»${recentCreator ? ` от ${recentCreator}` : ""}, у тебя сейчас довольно конкретное настроение.`,
      `«${recentTitle}»${recentCreator ? ` — ${recentCreator}` : ""} в списке последних — обычный человек так просто не добавит.`,
    ]);
  } else {
    line = "Данных достаточно для вывода, но не для комментария — и то хлеб.";
  }

  return `ментальный возраст: ${age} ${yearsWord(age)}\n${line}`;
}

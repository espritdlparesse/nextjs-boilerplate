import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildOwnerReadFilter, getEffectiveOwner, getOwnerScope } from "@/lib/ownerLinks";
import { generateFallbackVibecheck } from "@/lib/vibecheckFallback";

export const runtime = "nodejs";
// The vibecheck makes two editorial model calls in sequence, so the default function window is too short.
export const maxDuration = 60;

function vibeGenerationErrorResponse(error: unknown) {
  const details = error as { status?: number; code?: string; error?: { code?: string } };
  const code = details?.code ?? details?.error?.code;
  if (details?.status === 429 && code === "credit_balance_exhausted") {
    return NextResponse.json(
      { error: "вайбчек временно недоступен: закончились кредиты OpenAI API." },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: "сервис вайбчека временно недоступен. попробуй позже." }, { status: 503 });
}

type AnalysisPayload = {
  persona?: string;
  hook?: string;
  body?: string;
  closer?: string;
  summary?: string;
  highlights?: string[];
  basis?: string[];
};

type RoastPlanPayload = {
  candidates?: Array<{
    basis?: string[];
    observation?: string;
  }>;
};

type AnalysisRequestBody = {
  from?: number | null;
  to?: number | null;
};

type CulturalContextRow = {
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

type CulturalMemoryResponse = {
  cards?: Array<{
    lookup_key?: string;
    aliases?: string[];
    display_name?: string;
    kind?: "artist" | "author" | "director" | "work";
    context_note?: string;
    roast_angles?: string[];
    source_outlet?: CulturalSourceOutlet;
    source_url?: string;
    source_published_at?: string;
  }>;
};

function buildCreatorContext(
  items: Array<{ creator: string | null; title: string; type: string }>
) {
  const counts = new Map<string, { count: number; sampleTitle: string; type: string }>();

  for (const item of items) {
    const creator = item.creator?.trim();
    if (!creator) continue;
    const key = creator.toLowerCase();
    const current = counts.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    counts.set(key, { count: 1, sampleTitle: item.title, type: item.type });
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 12)
    .map(([creator, meta]) => `${creator} — ${meta.count} (${meta.type}; например, ${meta.sampleTitle})`)
    .join("\n");
}

function buildVibeSample(items: Array<{ type: string; title: string; creator: string | null }>) {
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

  for (const type of ["book", "film", "movie", "music"]) {
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

function extractJson<T = AnalysisPayload>(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

function looksTooCorporate(text: string) {
  const normalized = text.toLowerCase();
  const bannedPhrases = [
    "контентный срез",
    "демонстрирует",
    "сочетает в себе",
    "говорит о",
    "свидетельствует",
    "современный вкус",
    "молодежного восприятия",
    "молодежной аудитории",
    "наводит на размышления",
    "отражает тенденции",
    "указывает на",
    "варьируется",
    "представленная треками",
    "поиск глубины",
    "популярной культуры",
    "развлекательном контенте",
    "смешивать развлечения",
    "сложных философских размышлений",
    "этапы на пути к самопознанию",
    "присутствует",
    "список контента",
    "эклектичный вкус",
    "популярность",
  ];

  return bannedPhrases.some((phrase) => normalized.includes(phrase));
}

function looksTooAbstract(text: string) {
  const normalized = text.toLowerCase();
  const abstractSignals = [
    "культура",
    "контент",
    "аудитория",
    "динамика",
    "восприятие",
    "тенденции",
    "традиции",
    "современность",
    "самопознание",
    "разнообразие",
  ];
  const hitCount = abstractSignals.filter((signal) => normalized.includes(signal)).length;
  return hitCount >= 3;
}

function shouldRetryAnalysis(summary: string, highlights: string[], basis: string[]) {
  const combined = [summary, ...highlights, ...basis].join("\n");
  return looksTooCorporate(combined) || looksTooAbstract(summary);
}

function looksTooSoft(summary: string) {
  const normalized = summary.toLowerCase();
  const softSignals = [
    "в целом",
    "кажется",
    "можно заметить",
    "присутствует",
    "сочетание",
    "балансирует",
    "вызывает ассоциации",
    "начиная с",
    "заканчивая",
  ];
  return softSignals.some((signal) => normalized.includes(signal));
}

function looksTooComplicated(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("как будто") || normalized.includes("несмотря на то")) return true;

  return text
    .split(/[.!?]+/)
    .some((sentence) => sentence.trim().split(/\s+/).filter(Boolean).length > 22);
}

function looksTooGenericRoast(text: string) {
  const normalized = text.toLowerCase();
  const genericSignals = [
    "уличный вайб",
    "странная ностальгия",
    "ностальгия в обручальной",
    "свежие релизы",
    "эклектич",
    "атмосфера",
    "разброс",
    "разные вселенные",
    "на одной волне",
    "заряжаешься",
    "раскачиваешься",
    "старым советским шиком",
    "уличный рэп",
    "московских окраин",
    "громко взорвать",
    "тихо посидеть",
    "бокалом на кухне",
    "с бокалом на кухне",
    "умеешь и",
    "болеешь за",
    "андерграундный шум",
    "легкие поп-романсы",
    "лёгкие поп-романсы",
    "одновременно болеешь",
    "одновременно любишь",
    "умеешь слушать",
    "громко гремит",
    "шепчет о любви",
    "гремит, и тех",
    "громкий трэп",
    "тихие стихи",
    "тихие стихи про память",
    "слушаешь громкий",
    "читаешь тихие",
    "трэп и читаешь",
    "не отпускаешь мысль",
    "говорит бас",
    "говорит бас и",
    "бьет бас",
    "бьёт бас",
    "проверяют, выдержишь ли",
    "в одном ряду оказались",
    "одна растаскивает",
    "другая собирает себя",
    "болезненная честность про",
    "желание всё превратить в игру",
  ];

  return genericSignals.some((signal) => normalized.includes(signal));
}

function normalizeRoastNames(text: string) {
  return text
    .replace(/big baby tape/gi, "биг бейби тейп")
    .replace(/биг бейби тейп/gi, "биг бейби тейп")
    .replace(/avraam russo/gi, "авраам руссо")
    .replace(/авраам руссо/gi, "авраам руссо")
    .replace(/justin timberlake/gi, "джастин тимберлейк")
    .replace(/джастин тимберлейк/gi, "джастин тимберлейк")
    .replace(/bladee/gi, "блейди")
    .replace(/блейди/gi, "блейди");
}

function normalizeContextKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[«»"'`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function getCulturalContext(
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
    const aliases = [entry.lookup_key, ...(entry.aliases ?? [])].map(normalizeContextKey);
    return aliases.some((alias) => keys.has(alias));
  });
}

async function getRecentBadVibes(sb: ReturnType<typeof supabaseAdmin>, auth: Parameters<typeof getEffectiveOwner>[0]) {
  const owner = await getEffectiveOwner(auth);
  const { data } = await sb.from("vibe_feedback").select("summary").eq("owner_key", owner.ownerKey).eq("rating", "bad").order("created_at", { ascending: false }).limit(5);
  return (data ?? []).map((row) => row.summary).filter((summary): summary is string => typeof summary === "string");
}

function getMemoryCandidates(items: Array<{ title: string; creator: string | null }>) {
  const creators = items.map((item) => item.creator ?? "");
  const works = items.map((item) => item.title);
  return Array.from(new Set([...creators, ...works].map((value) => value.trim()).filter((value) => value.length >= 3))).slice(0, 8);
}

const CULTURAL_SOURCE_HOSTS: Record<CulturalSourceOutlet, string[]> = {
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

function isAllowedMemorySource(url: string, outlet: CulturalSourceOutlet, publishedAt?: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const allowedHost = CULTURAL_SOURCE_HOSTS[outlet]?.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    if (!allowedHost) return false;
    if (outlet !== "afisha_archive") return true;
    return Boolean(publishedAt) && new Date(`${publishedAt}T00:00:00Z`).getTime() < Date.UTC(2021, 0, 1);
  } catch {
    return false;
  }
}

async function enrichCulturalContext(args: {
  sb: ReturnType<typeof supabaseAdmin>;
  apiKey: string;
  model: string;
  items: Array<{ title: string; creator: string | null }>;
  existing: CulturalContextRow[];
}) {
  const knownKeys = new Set(
    args.existing.flatMap((entry) => [entry.lookup_key, ...(entry.aliases ?? [])]).map(normalizeContextKey)
  );
  const candidates = getMemoryCandidates(args.items).filter((candidate) => !knownKeys.has(normalizeContextKey(candidate)));
  if (candidates.length === 0) return;

  const raw = await createWebAwareAnalysis({
    apiKey: args.apiKey,
    model: args.model,
    instructions:
      "Ты пополняешь маленькую культурную память для приложения Everyyou. Ищи сведения только в The Atlantic, The New Yorker, The New York Times, «Медузе», The Bell, Кинопоиске, WOS (w-o-s.ru), архиве «Афиши» до 1 января 2021 года, X/Twitter и Facebook Ильи Красильщика, Wonderzine. Для каждого имени из списка попробуй найти один материал в этих изданиях. Не используй другие сайты и не выдумывай URL. Для X/Facebook принимай только посты самого Ильи Красильщика, а не упоминания о нем. Добавляй карточку только если есть настоящая ссылка именно на разрешенный источник. Карточка — это короткий пересказ фактуры в 1-2 предложениях: репутация, сцена, узнаваемый образ или культурное значение. Не пиши биографию и не оценивай человека. roast_angles — 1-2 короткие опоры для будущего точного наблюдения, не готовые шутки. Если это «Афиша», верни дату публикации в source_published_at строго в формате YYYY-MM-DD и используй только дату до 2021-01-01. Верни только JSON без markdown: {cards:[{lookup_key,aliases,display_name,kind,context_note,roast_angles,source_outlet,source_url,source_published_at}]}. source_outlet должен быть одним из: the_atlantic, new_yorker, nyt, meduza, the_bell, kinopoisk, wos, afisha_archive, x_ilya_krasilshchik, facebook_ilya_krasilshchik, wonderzine. kind может быть только artist, author, director или work.",
    prompt: `Найди карточки только для этих имен из личной библиотеки:\n${candidates.map((candidate) => `- ${candidate}`).join("\n")}`,
  });
  const parsed = extractJson<CulturalMemoryResponse>(raw);
  const rows = (parsed?.cards ?? [])
    .map((card) => {
      const lookupKey = normalizeContextKey(card.lookup_key ?? card.display_name ?? "");
      const outlet = card.source_outlet;
      const sourceUrl = card.source_url?.trim() ?? "";
      if (
        !lookupKey ||
        !card.display_name?.trim() ||
        !card.context_note?.trim() ||
        !outlet ||
        !sourceUrl ||
        !isAllowedMemorySource(sourceUrl, outlet, card.source_published_at)
      ) {
        return null;
      }

      return {
        lookup_key: lookupKey,
        aliases: Array.from(new Set([...(card.aliases ?? []), card.display_name])).map(normalizeContextKey).filter(Boolean),
        display_name: card.display_name.trim(),
        kind: card.kind ?? "work",
        context_note: card.context_note.trim().slice(0, 420),
        roast_angles: (card.roast_angles ?? []).map((angle) => angle.trim()).filter(Boolean).slice(0, 2),
        source_outlet: outlet,
        source_url: sourceUrl,
        source_published_at: card.source_published_at ?? null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length > 0) {
    await args.sb.from("cultural_context").upsert(rows, { onConflict: "lookup_key" });
  }
}

async function createWebAwareAnalysis(args: {
  apiKey: string;
  model: string;
  prompt: string;
  instructions: string;
}) {
  const client = new OpenAI({ apiKey: args.apiKey });

  const response = await client.responses.create({
    model: args.model,
    instructions: args.instructions,
    input: args.prompt,
    max_output_tokens: 1100,
    tools: [{ type: "web_search_preview", search_context_size: "medium" }],
    tool_choice: "auto",
  });

  return response.output_text ?? "";
}

async function createRoastText(args: {
  apiKey: string;
  model: string;
  prompt: string;
  instructions: string;
}) {
  const client = new OpenAI({ apiKey: args.apiKey });
  const response = await client.responses.create({
    model: args.model,
    instructions: args.instructions,
    input: args.prompt,
    max_output_tokens: 550,
  });

  return response.output_text ?? "";
}

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const scope = await getOwnerScope(auth);
  const body = (await req.json().catch(() => null)) as AnalysisRequestBody | null;
  const from = typeof body?.from === "number" && Number.isFinite(body.from) ? body.from : null;
  const to = typeof body?.to === "number" && Number.isFinite(body.to) ? body.to : null;
  const hasRange = from !== null && to !== null;

  const sb = supabaseAdmin();
  let baseQuery = sb.from("items").select("type, title, creator").or(buildOwnerReadFilter(scope));
  if (hasRange) {
    baseQuery = baseQuery
      .gte("consumed_at", new Date(from).toISOString())
      .lte("consumed_at", new Date(to).toISOString());
  }

  let { data: items, error } = await baseQuery
    .order("consumed_at", { ascending: false, nullsFirst: false })
    .limit(hasRange ? 1000 : 300);

  if (error?.message?.toLowerCase().includes("consumed_at")) {
    let fallbackQuery = sb.from("items").select("type, title, creator").or(buildOwnerReadFilter(scope));
    if (hasRange) {
      fallbackQuery = fallbackQuery
        .gte("created_at", new Date(from).toISOString())
        .lte("created_at", new Date(to).toISOString());
    }
    const fallback = await fallbackQuery.order("created_at", { ascending: false }).limit(hasRange ? 1000 : 300);
    items = fallback.data;
    error = fallback.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!items || items.length === 0) {
    return NextResponse.json({
      itemCount: 0,
      summary: "пока нечего анализировать. добавь хотя бы несколько треков, книг или фильмов.",
      highlights: ["начни со spotify import", "или добавь что-то вручную"],
      basis: [],
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

  const vibeSample = buildVibeSample(items);
  const recentLines = vibeSample
    .map((item) => `[${item.type}] ${item.title}${item.creator ? ` — ${item.creator}` : ""}`)
    .join("\n");
  const creatorContext = buildCreatorContext(items);
  const culturalContext = await getCulturalContext(sb, items);
  const culturalMemory = culturalContext?.length
    ? culturalContext
        .map(
          (entry) =>
            `${entry.display_name}: ${entry.context_note} Возможные опоры: ${entry.roast_angles.join("; ")}. Источник: ${entry.source_outlet}.`
        )
        .join("\n")
    : "карточек для этих имен пока нет";
  const badFeedback = await getRecentBadVibes(sb, auth);

  // A vibecheck is the product, not a background summary: use the stronger editor by default.
  const model = process.env.OPENAI_VIBECHECK_MODEL ?? "gpt-4.1";
  const libraryLines = vibeSample
    .map((item) => `[${item.type}] ${item.title}${item.creator ? ` — ${item.creator}` : ""}`)
    .join("\n");
  const planningPrompt = `Вот выборка из библиотеки:\n${libraryLines}\n\nПроверенная культурная фактура, если она относится к выбранной паре:\n${culturalMemory}\n\nПользователь уже забраковал эти формулировки. Не повторяй их приемы и не пересказывай их другими словами:\n${badFeedback.join("\n") || "пока нет"}`;
  let planRaw = "";
  try {
    planRaw = await createRoastText({
      apiKey,
      model,
      instructions:
        "Ты редактор, который сначала ищет материал для короткой прожарки. Не пиши сам вайбчек. Верни только JSON: {candidates:[{basis:string[],observation:string}]}. Дай ровно 3 кандидата. В basis укажи две реальные позиции из списка дословно. В каждом кандидате смешивай разные типы медиа, если они есть. Не выбирай одну и ту же пару или одного и того же артиста во всех вариантах. observation — одно простое, проверяемое наблюдение о столкновении именно этих двух позиций: культурная поза, переосмысление названия, видимая социальная или бытовая ситуация. Не пиши про звук, бас, громкость, жанры, атмосферу, ностальгию, абстрактные 'мысли' и внутренний мир пользователя. Не выдумывай факты. Твоя задача — дать автору конкретную опору, а не красивую фразу.",
      prompt: planningPrompt,
    });
  } catch (error) {
    console.error("vibecheck planning failed", error);
    const fallback = generateFallbackVibecheck(items);
    if (fallback) return NextResponse.json(fallback);
    return vibeGenerationErrorResponse(error);
  }
  const planned = extractJson<RoastPlanPayload>(planRaw)?.candidates ?? [];
  const plans = planned.filter((candidate) =>
    Array.isArray(candidate.basis) && candidate.basis.length >= 2 && Boolean(candidate.observation?.trim())
  );
  const selectedPlan = plans.length > 0 ? plans[Math.floor(Math.random() * plans.length)] : null;
  const selectedBasis = selectedPlan?.basis?.slice(0, 3).join(" | ") ?? "выбери одну пару из списка";
  const selectedObservation = selectedPlan?.observation?.trim() ?? "найди одно точное столкновение этих позиций";

  let generationError: unknown = null;
  const writeRoast = async (repair = false) => {
    try {
      const raw = await createRoastText({
      apiKey,
      model,
      instructions:
        "Ты финальный редактор вайбчека Everyyou. Верни только JSON: {persona:string,hook:string,body:string,closer:string,highlights:string[],basis:string[]}. Напиши ровно две короткие строки: hook и body; closer оставь пустым. В hook назови две реальные позиции из выбранной пары. В body сделай ясный, острый, но человеческий вывод, который невозможен без этой пары. Пиши по-русски, простыми словами, без сложного синтаксиса. Имена артистов и авторов передавай привычной русской транскрипцией и строчными буквами. Не описывай жанры, звук или настроение произведений. Не придумывай декорации и действия: нельзя писать про бас, громкость, кухню, бокалы, вечер, окна, танцпол, взрывы или 'мысли', если этого нет в самих позициях. Не используй 'вайб', 'атмосфера', 'ностальгия', 'разные вселенные', 'на одной волне', 'тебе нравится', 'ты умеешь', 'громкий/тихий + жанр'. Не ставь диагноз и не объясняй шутку. Не добавляй третью мысль. Если выбранная опора слабая, выбери более точную пару из списка. Текст должен звучать как точное замечание знакомого, а не как культурологический разбор.",
      prompt: `${planningPrompt}\n\nВыбранная пара: ${selectedBasis}\nНаблюдение редактора: ${selectedObservation}${repair ? "\n\nПредыдущий вариант был плохим: перепиши с нуля еще короче и конкретнее. Не используй метафору вместо наблюдения." : ""}`,
      });
      return extractJson<AnalysisPayload>(raw);
    } catch (error) {
      console.error("vibecheck writing failed", error);
      generationError = error;
      return null;
    }
  };

  let finalRoast = await writeRoast();
  if (generationError) {
    const fallback = generateFallbackVibecheck(items);
    if (fallback) return NextResponse.json(fallback);
    return vibeGenerationErrorResponse(generationError);
  }
  let hook = finalRoast?.hook?.trim() ?? "";
  let bodyText = finalRoast?.body?.trim() ?? "";
  let closer = finalRoast?.closer?.trim() ?? "";
  let highlights = Array.isArray(finalRoast?.highlights)
    ? finalRoast.highlights.map((item) => item.trim()).filter(Boolean).slice(0, 3)
    : [];
  let basis = Array.isArray(finalRoast?.basis)
    ? finalRoast.basis.map((item) => item.trim()).filter(Boolean).slice(0, 3)
    : selectedPlan?.basis?.slice(0, 3) ?? [];

  const candidateText = [hook, bodyText, closer].join(" ");
  if (!hook || !bodyText || looksTooComplicated(candidateText) || looksTooGenericRoast(candidateText)) {
    finalRoast = await writeRoast(true);
    if (generationError) {
      const fallback = generateFallbackVibecheck(items);
      if (fallback) return NextResponse.json(fallback);
      return vibeGenerationErrorResponse(generationError);
    }
    hook = finalRoast?.hook?.trim() ?? hook;
    bodyText = finalRoast?.body?.trim() ?? bodyText;
    closer = finalRoast?.closer?.trim() ?? "";
    highlights = Array.isArray(finalRoast?.highlights)
      ? finalRoast.highlights.map((item) => item.trim()).filter(Boolean).slice(0, 3)
      : highlights;
    basis = Array.isArray(finalRoast?.basis)
      ? finalRoast.basis.map((item) => item.trim()).filter(Boolean).slice(0, 3)
      : basis;
  }

  hook = normalizeRoastNames(hook);
  bodyText = normalizeRoastNames(bodyText);
  closer = normalizeRoastNames(closer);
  highlights = highlights.map(normalizeRoastNames);
  basis = basis.map(normalizeRoastNames);

  const combinedSummary = [hook, bodyText, closer].filter(Boolean).join(" ");
  if (!hook || !bodyText || looksTooComplicated(combinedSummary) || looksTooGenericRoast(combinedSummary)) {
    return NextResponse.json(
      { error: "сегодня алгоритм не нашел достаточно точную пару. попробуй еще раз — лучше пусто, чем банально." },
      { status: 422 }
    );
  }
  if (combinedSummary) {
    return NextResponse.json({
      itemCount: items.length,
      persona: finalRoast?.persona?.trim() ?? "",
      summary: combinedSummary,
      basis: basis.length > 0 ? basis : selectedPlan?.basis?.slice(0, 3) ?? [],
      highlights,
    });
  }

  {
  const prompt = `Сделай вайбчек по этому списку и верни JSON. Не выбирай двух артистов, если в выборке есть книги или фильмы: ищи более неожиданное столкновение между типами. Ответ недействителен, если он сводится к формуле «громкий/тихий + жанр», например «громкий трэп и тихие стихи». Нужен поворот смысла: переиначенное название, узнаваемая культурная поза или точное человеческое наблюдение.

Последние и самые заметные айтемы:
${recentLines}

Повторяющиеся авторы и артисты:
${creatorContext || "повторов почти нет"}

Культурная память (используй только если она делает вывод точнее; не пересказывай карточки и не упоминай источники):
${culturalMemory}

Представительная выборка из разных типов:
${recentLines}`;

  const raw = await createWebAwareAnalysis({
    apiKey,
    model,
    instructions:
      "Ты пишешь обычный вайбчек по библиотеке. Это короткая прожарка в простом, разговорном стиле: как одно точное наблюдение из телеграм-канала, а не как культурный разбор. Говори на 'ты'. Сначала выбери две или три позиции, которые действительно противоречат друг другу по стилю, репутации, настроению или аудитории. Не выбирай просто похожие любимые вещи. Затем строй вайбчек вокруг этой пары, а не вокруг всей библиотеки. В поле «Культурная память» есть проверенные факты и возможные углы: используй их как фактуру, но никогда не пересказывай карточку, не называй источник и не подменяй наблюдение биографией. Лучший результат обычно состоит из двух коротких строк. Первая называет пару. Она может быть вопросом, но не должна всегда начинаться с вопроса. Вторая строка дает точный смешной вывод, который существует только из-за этой пары. Не придумывай кинематографическую бытовую сцену: никаких бокалов на кухне, вечерних окон, взрывов, танцполов и других декораций, которых нет в библиотеке. Называя артистов и авторов, всегда используй привычную русскую передачу имен строчными буквами: 'биг бейби тейп', 'авраам руссо', 'джастин тимберлейк', 'блейди'. Не используй латиницу для имен исполнителей, если имя можно нормально написать по-русски. Хорошая форма: 'биг бейби тейп и авраам руссо. кажется, на семейном празднике тебе наконец дали поставить музыку.' Это пример конкретности, а не заготовка для копирования. Примеры формы: 'Блейди и София Коппола? набор эстета в депрессии, жму руку.', 'Ого, Блейди и София Коппола. кажется, у кого-то была непростая неделя.', '«Я обязательно уволюсь» и Lovestoned? похоже, ты решила уволиться из отношений. рабочих или романтических.', '«Комната Вагинова» и «Канистра»? похоже, сегодня хотелось грязи.' или 'Ого, «Ученичество, или Книга наслаждений» и SexyBack вместе! круто, когда во время духовного роста в перерывах можно потанцевать.' Не копируй эти фразы дословно и не используй их как заготовку. Если у айтемов есть общая узнаваемая фактура, называй ее прямо одним понятным словом. Лучше 'сегодня хотелось грязи', чем пустое описание формы вроде 'хотелось чего-то тесного и громкого'. Можно сделать острее двумя способами: переиначить название произведения ('«Фрагменты речи влюбленного»? скорее фрагменты речи того, кто боится говорить о своих чувствах.') или уколоть видимую культурную позу, сцену, статусную фантазию или отношение к привилегии ('«Наследники» и Fleetwood Mac? тебе нравится критиковать богатых, пока это красиво снято.'). Целью критики должна быть эстетическая поза, а не врожденная идентичность человека. Не угадывай и не высмеивай расу, гендерную идентичность, сексуальность, религию, национальность, инвалидность, возраст или класс пользователя по библиотеке. Если список это поддерживает, используй мягкое противоречие: назови внешнее качество, а затем скрытое человеческое напряжение. Пример: 'тебе, кажется, нравится, когда все красиво, но никому не хорошо'. Это не лозунг и не шаблон: используй его только при реальной опоре на айтемы. Текст должен быть простым: короткие фразы, один смысл, без сложного синтаксиса. Каждая строка должна быть понятна сразу, без расшифровки частной метафоры. Ответ недействителен, если после удаления имен артистов он подходит к любой другой случайной паре. Нельзя просто назвать два жанра, «вайб», «ностальгию», «атмосферу» или сказать 'тебе нравится X и Y'. Запрещены пустые формулы: 'разные вселенные', 'на одной волне', 'заряжаешься', 'раскачиваешься', 'старый советский шик', 'уличный рэп с московских окраин', 'громко взорвать', 'тихо посидеть с бокалом на кухне'. Не используй англоязычную конструкцию панча и пустые пары слов вроде 'и кризис, и припев'. Не прикрепляй человеческое действие к абстракции ради контраста: можно танцевать во время духовного роста, но нельзя танцевать под духовный рост. Если игра слов не складывается в ясную русскую мысль, убери ее. Не объясняй шутку и не пытайся быть остроумным в каждой строке. Ирония не обязательна. Лучше тихое, немного неловкое наблюдение, чем громкий панч. Неправильно: 'список контента балансирует на грани', 'музыка вызывает ассоциации', 'в целом сочетание', 'книги исследуют', 'фильмы варьируются', 'это указывает на', 'это говорит о'. Не пиши как культуролог, психолог, редактор медиа или школьный отличник. Не используй слова 'контент', 'аудитория', 'тенденции', 'современность', 'поп-культура', 'самопознание', 'восприятие', 'разнообразие'. Не описывай жанры и не пересказывай, кто популярен. Не давай рекомендации, не ставь диагнозы, не пиши 'красный флаг'. Не приписывай человеку скрытые мотивы или поведение, которых библиотека не может показать: нельзя писать 'поэтому ты молчишь', 'тебе никто не нужен' или 'ты боишься'. Легкий вывод о настроении выбранного периода допустим, если он прямо поддержан айтемами. Не выдумывай факты. Не копируй мемные шаблоны и готовые формулы из чужих каналов. Не заканчивай текст большой литературной фразой, лозунгом или нарочито умной игрой слов. В полном тексте можно использовать не больше одного сравнения и нельзя строить фразы по схеме 'ты делаешь X, как будто Y'. Верни только JSON без markdown с полями persona:string, hook:string, body:string, closer:string, highlights:string[], basis:string[]. persona — короткий ярлык на 2-5 простых слов. hook — первая строка с двумя или тремя айтемами, до 16 слов. body — вторая строка до 20 слов. closer — пустая строка, если первые две уже работают; иначе до 12 слов. highlights — 3 короткие реплики на 'ты', каждая до 12 слов и без новой темы. basis — именно те 2-3 позиции, на которых держится вывод.",
    prompt,
  });

  let parsed = extractJson(raw);
  let persona = parsed?.persona?.trim() || "";
  let hook = parsed?.hook?.trim() || "";
  let bodyText = parsed?.body?.trim() || "";
  let closer = parsed?.closer?.trim() || "";
  let summary =
    parsed?.summary?.trim() ||
    `в библиотеке ${items.length} айтемов. чувствуется устойчивый культурный паттерн, но ответ модели вернулся не в том формате.`;
  let highlights = Array.isArray(parsed?.highlights)
    ? parsed.highlights.map((item) => item.trim()).filter(Boolean).slice(0, 6)
    : [];
  let basis = Array.isArray(parsed?.basis)
    ? parsed.basis.map((item) => item.trim()).filter(Boolean).slice(0, 3)
    : [];

  if (
    shouldRetryAnalysis(summary, highlights, basis) ||
    looksTooSoft(summary) ||
    looksTooComplicated([hook, bodyText, closer, ...highlights].join(" ")) ||
    looksTooGenericRoast([hook, bodyText, closer, ...highlights].join(" ")) ||
    !hook ||
    !bodyText
  ) {
    const retryRaw = await createWebAwareAnalysis({
      apiKey,
      model,
      instructions:
        "Ты уже один раз написал слишком сложно или слишком общо. Перепиши вайбчек как короткое наблюдение из хорошего телеграм-канала. Простые слова. Две короткие строки. Сначала выбери две или три позиции, которые действительно противоречат друг другу по стилю, репутации или настроению. Первая строка называет эту пару. Вторая строка дает неожиданный, но понятный вывод, который работает только с этой парой. Никаких придуманных бытовых сцен и декораций: не пиши про бокал на кухне, вечер, окна, взрывы, танцпол или одиночество, если этого прямо не дают названия и сами произведения. Нельзя просто назвать «вайб», «ностальгию», «атмосферу» или написать 'тебе нравится X и Y'. Запрещены формулы 'разные вселенные', 'на одной волне', 'заряжаешься', 'раскачиваешься', 'советский шик', 'уличный рэп с окраин', 'громко взорвать', 'тихо посидеть'. Если после удаления имен артистов текст подходит любой случайной паре, он плохой. Пиши имена артистов привычной русской передачей, без латиницы и строчными буквами: 'биг бейби тейп', 'авраам руссо', 'джастин тимберлейк'. Формы: 'Блейди и София Коппола? набор эстета в депрессии, жму руку.' или 'Ого, Блейди и София Коппола. кажется, у кого-то была непростая неделя.' Не копируй примеры дословно. Можно переиначить название произведения или уколоть видимую культурную позу, статусную фантазию и отношение к привилегии. Не критикуй и не угадывай по библиотеке расу, гендерную идентичность, сексуальность, религию, национальность, инвалидность, возраст или класс пользователя. Каждая строка должна быть понятна сразу. Не используй англоязычный ритм панча и пустые пары слов вроде 'и кризис, и припев'. Не объясняй вывод. Не строй сравнения одно на другом. Никакой статьи про культуру и никаких рекомендаций. Запрещены конструкции: 'список балансирует', 'музыка вызывает ассоциации', 'в целом это сочетание', 'можно заметить', 'представленная здесь музыка', 'книги исследуют', 'фильмы варьируются', 'это говорит о', 'это указывает на'. Хороший пример: 'вижу Блейди и Зебальда. кажется, ты выбираешь вещи, где кому-то так же плохо, как иногда тебе'. Плохой пример: 'эклектичный вкус сочетает популярную музыку с философской литературой'. Не используй конструкцию 'ты делаешь X, как будто Y', мемные шаблоны, лозунги или нарочито умные финальные фразы. Верни только JSON без markdown с полями persona:string, hook:string, body:string, closer:string, highlights:string[], basis:string[]. persona — 2-5 простых слов. hook — первая строка до 16 слов. body — вторая строка до 20 слов. closer — пустая строка, если первые две уже работают; иначе до 12 слов. highlights — 3 короткие реплики на 'ты', без новых тем. basis — только те 2-3 конкретные позиции, на которых держится вывод.",
      prompt: `${prompt}

Сейчас особенно важно: сначала найди одно главное противоречие вкуса и строй текст только вокруг него. Не пиши академически. Не пиши абзац как сочинение. Пиши как короткую устную оценку.`,
    });
    const retryParsed = extractJson(retryRaw);
    if (retryParsed) {
      parsed = retryParsed;
      persona = retryParsed.persona?.trim() || persona;
      hook = retryParsed.hook?.trim() || hook;
      bodyText = retryParsed.body?.trim() || bodyText;
      closer = retryParsed.closer?.trim() || closer;
      summary =
        retryParsed.summary?.trim() ||
        summary;
      highlights = Array.isArray(retryParsed.highlights)
        ? retryParsed.highlights.map((item) => item.trim()).filter(Boolean).slice(0, 6)
        : highlights;
      basis = Array.isArray(retryParsed.basis)
        ? retryParsed.basis.map((item) => item.trim()).filter(Boolean).slice(0, 3)
        : basis;
    }
  }

  // A retry is still model output, so reject stock imagery a second time before it reaches the card.
  if (looksTooGenericRoast([hook, bodyText, closer, ...highlights].join(" "))) {
    const lastChanceRaw = await createWebAwareAnalysis({
      apiKey,
      model,
      instructions:
        "Перепиши ответ с нуля. Предыдущий текст не годится: он заменил наблюдение выдуманной сценкой. Верни две короткие, ясные строки. В первой назови две конкретные позиции из списка. Во второй сделай точный вывод только из их столкновения. Не пиши про кухню, бокалы, вечер, окна, взрыв, тишину, танцпол, атмосферу или ностальгию. Не описывай жанры. Не ставь диагноз пользователю. Не объясняй шутку. Имена артистов пиши по-русски и строчными буквами. Верни только JSON: {persona:string,hook:string,body:string,closer:string,highlights:string[],basis:string[]}.",
      prompt,
    });
    const lastChance = extractJson(lastChanceRaw);
    if (lastChance?.hook?.trim() && lastChance.body?.trim()) {
      persona = lastChance.persona?.trim() || persona;
      hook = lastChance.hook.trim();
      bodyText = lastChance.body.trim();
      closer = lastChance.closer?.trim() || "";
      highlights = Array.isArray(lastChance.highlights)
        ? lastChance.highlights.map((item) => item.trim()).filter(Boolean).slice(0, 6)
        : highlights;
      basis = Array.isArray(lastChance.basis)
        ? lastChance.basis.map((item) => item.trim()).filter(Boolean).slice(0, 3)
        : basis;
    }
  }

  hook = normalizeRoastNames(hook);
  bodyText = normalizeRoastNames(bodyText);
  closer = normalizeRoastNames(closer);
  summary = normalizeRoastNames(summary);
  highlights = highlights.map(normalizeRoastNames);
  basis = basis.map(normalizeRoastNames);

  const combinedSummary = [hook, bodyText || summary, closer].filter(Boolean).join(" ");

  return NextResponse.json({
    itemCount: items.length,
    persona,
    summary: combinedSummary,
    basis:
      basis.length > 0
        ? basis
        : ["последние айтемы периода", "повторяющиеся артисты и авторы"],
    highlights:
      highlights.length > 0
        ? highlights
      : ["многое держится вокруг повторяющихся авторов и артистов", "у вкуса уже есть понятный эмоциональный контур"],
  });
  }
}

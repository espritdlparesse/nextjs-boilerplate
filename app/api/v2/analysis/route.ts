import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildOwnerReadFilter, getEffectiveOwner, getOwnerScope } from "@/lib/ownerLinks";
import { generateFallbackVibecheck } from "@/lib/vibecheckFallback";
import { countDeliveredRuns, recordVibeDuel, recordVibeRun, type VibeRunOutcome } from "@/lib/vibeRuns";
import { countItemTypes, type ItemType } from "@/lib/mediaTypes";

export const runtime = "nodejs";
// The vibecheck makes two editorial model calls in sequence, so the default function window is too short.
export const maxDuration = 60;

// Bump on every edit to the planner or editor instructions below. The holdout compares against it.
const PROMPT_VERSION = "2026-09-05.roast-v2-types";

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
    types?: string[];
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

// Пользовательские категории у каждого свои, поэтому прожарка на них не
// строится: в выборку идут только общие типы.
const VIBE_SAMPLE_TYPES: ItemType[] = ["music", "book", "movie"];

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

function blockingGates(text: string) {
  const hits: string[] = [];
  if (looksTooComplicated(text)) hits.push("too_complicated");
  if (looksTooGenericRoast(text)) hits.push("too_generic");
  return hits;
}

// Наблюдающие гейты: попадают в gate_hits, но отказ не вызывают. Так копится
// статистика по фразам, снятым с боевого пути 2026-08-31 в коммите 1d39166.
function observedGates(text: string) {
  const hits: string[] = [];
  if (looksTooCorporate(text)) hits.push("observed_corporate");
  if (looksTooAbstract(text)) hits.push("observed_abstract");
  if (looksTooSoft(text)) hits.push("observed_soft");
  return hits;
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

async function getRecentBadVibes(sb: ReturnType<typeof supabaseAdmin>, ownerKey: string) {
  const { data } = await sb.from("vibe_feedback").select("summary").eq("owner_key", ownerKey).eq("rating", "bad").order("created_at", { ascending: false }).limit(5);
  return (data ?? []).map((row) => row.summary).filter((summary): summary is string => typeof summary === "string");
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

type RoastPlan = { basis?: string[]; types?: string[]; observation?: string };

type RoastVariant = {
  ok: boolean;
  summary: string;
  persona: string;
  basis: string[];
  highlights: string[];
  gateHits: string[];
  retried: boolean;
  error: unknown;
};

const ROAST_EDITOR_INSTRUCTIONS =
  "Ты финальный редактор вайбчека Everyyou. Верни только JSON: {persona:string,hook:string,body:string,closer:string,highlights:string[],basis:string[]}. Напиши ровно две короткие строки: hook и body; closer оставь пустым. В hook назови две реальные позиции из выбранной пары. В body сделай ясный, острый, но человеческий вывод, который невозможен без этой пары. Пиши по-русски, простыми словами, без сложного синтаксиса. Имена артистов и авторов передавай привычной русской транскрипцией и строчными буквами. Не описывай жанры, звук или настроение произведений. Не придумывай декорации и действия: нельзя писать про бас, громкость, кухню, бокалы, вечер, окна, танцпол, взрывы или 'мысли', если этого нет в самих позициях. Не используй 'вайб', 'атмосфера', 'ностальгия', 'разные вселенные', 'на одной волне', 'тебе нравится', 'ты умеешь', 'громкий/тихий + жанр'. Не ставь диагноз и не объясняй шутку. Не добавляй третью мысль. Если выбранная опора слабая, выбери более точную пару из списка. Текст должен звучать как точное замечание знакомого, а не как культурологический разбор.";

const ROAST_REPAIR_SUFFIX =
  "\n\nПредыдущий вариант был плохим: перепиши с нуля еще короче и конкретнее. Не используй метафору вместо наблюдения.";

function readRoastFields(payload: AnalysisPayload | null, fallbackBasis: string[]) {
  return {
    persona: payload?.persona?.trim() ?? "",
    hook: payload?.hook?.trim() ?? "",
    body: payload?.body?.trim() ?? "",
    closer: payload?.closer?.trim() ?? "",
    highlights: Array.isArray(payload?.highlights)
      ? payload.highlights.map((line) => line.trim()).filter(Boolean).slice(0, 3)
      : [],
    basis: Array.isArray(payload?.basis)
      ? payload.basis.map((line) => line.trim()).filter(Boolean).slice(0, 3)
      : fallbackBasis,
  };
}

function pickDistinctPlans(plans: RoastPlan[], howMany: number) {
  const pool = [...plans];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, howMany);
}

async function composeRoastVariant(args: {
  apiKey: string;
  model: string;
  planningPrompt: string;
  plan: RoastPlan | null;
}): Promise<RoastVariant> {
  const planBasis = args.plan?.basis?.slice(0, 3) ?? [];
  const pairLine = planBasis.join(" | ") || "выбери одну пару из списка";
  const observation = args.plan?.observation?.trim() || "найди одно точное столкновение этих позиций";
  const gateHits: string[] = [];

  const write = async (repair: boolean) => {
    const raw = await createRoastText({
      apiKey: args.apiKey,
      model: args.model,
      instructions: ROAST_EDITOR_INSTRUCTIONS,
      prompt: `${args.planningPrompt}\n\nВыбранная пара: ${pairLine}\nНаблюдение редактора: ${observation}${repair ? ROAST_REPAIR_SUFFIX : ""}`,
    });
    return extractJson<AnalysisPayload>(raw);
  };

  const failed = (error: unknown, retried: boolean): RoastVariant => ({
    ok: false,
    summary: "",
    persona: "",
    basis: [],
    highlights: [],
    gateHits,
    retried,
    error,
  });

  let fields;
  try {
    fields = readRoastFields(await write(false), planBasis);
  } catch (error) {
    console.error("vibecheck writing failed", error);
    return failed(error, false);
  }

  const firstGates = blockingGates([fields.hook, fields.body, fields.closer].join(" "));
  gateHits.push(...firstGates);

  let retried = false;
  if (!fields.hook || !fields.body || firstGates.length > 0) {
    retried = true;
    try {
      const repaired = readRoastFields(await write(true), fields.basis);
      fields = {
        persona: repaired.persona || fields.persona,
        hook: repaired.hook || fields.hook,
        body: repaired.body || fields.body,
        closer: repaired.closer,
        highlights: repaired.highlights.length > 0 ? repaired.highlights : fields.highlights,
        basis: repaired.basis.length > 0 ? repaired.basis : fields.basis,
      };
    } catch (error) {
      console.error("vibecheck writing failed", error);
      return failed(error, true);
    }
  }

  const summary = normalizeRoastNames([fields.hook, fields.body, fields.closer].filter(Boolean).join(" "));
  const finalGates = blockingGates(summary);
  gateHits.push(...finalGates, ...observedGates(summary));

  return {
    ok: Boolean(fields.hook) && Boolean(fields.body) && finalGates.length === 0,
    summary,
    persona: fields.persona,
    basis: (fields.basis.length > 0 ? fields.basis : planBasis).map(normalizeRoastNames),
    highlights: fields.highlights.map(normalizeRoastNames),
    gateHits,
    retried,
    error: null,
  };
}

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const scope = await getOwnerScope(auth);
  const owner = await getEffectiveOwner(auth);
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
  const culturalContext = await getCulturalContext(sb, items);
  const culturalMemory = culturalContext?.length
    ? culturalContext
        .map(
          (entry) =>
            `${entry.display_name}: ${entry.context_note} Возможные опоры: ${entry.roast_angles.join("; ")}. Источник: ${entry.source_outlet}.`
        )
        .join("\n")
    : "карточек для этих имен пока нет";
  const badFeedback = await getRecentBadVibes(sb, owner.ownerKey);

  // A vibecheck is the product, not a background summary: use the stronger editor by default.
  const model = process.env.OPENAI_VIBECHECK_MODEL ?? "gpt-4.1";

  let plansValidCount = 0;

  const saveRun = (fields: {
    outcome: VibeRunOutcome;
    summary?: string | null;
    selectedBasis?: string[];
    plannerObservation?: string | null;
    mediaCounts?: Record<string, number>;
    gateHits?: string[];
    retryCount?: number;
  }) =>
    recordVibeRun(sb, {
      ownerKey: owner.ownerKey,
      ownerKind: owner.ownerKind,
      promptVersion: PROMPT_VERSION,
      model,
      itemCount: items.length,
      plansValidCount,
      ...fields,
    });

  const deliverFallback = async (error: unknown) => {
    const fallback = generateFallbackVibecheck(items);
    if (!fallback) return vibeGenerationErrorResponse(error);
    const runId = await saveRun({
      outcome: "fallback",
      summary: fallback.summary,
      selectedBasis: fallback.basis,
    });
    return NextResponse.json({ ...fallback, runId });
  };
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
        "Ты редактор, который сначала ищет материал для короткой прожарки. Не пиши сам вайбчек. Верни только JSON: {candidates:[{basis:string[],types:string[],observation:string}]}. Дай ровно 3 кандидата. В basis укажи две реальные позиции из списка дословно. В types укажи тип каждой позиции в том же порядке: music, book или movie. В каждом кандидате смешивай разные типы медиа, если они есть. Не выбирай одну и ту же пару или одного и того же артиста во всех вариантах. observation — одно простое, проверяемое наблюдение о столкновении именно этих двух позиций: культурная поза, переосмысление названия, видимая социальная или бытовая ситуация. Не пиши про звук, бас, громкость, жанры, атмосферу, ностальгию, абстрактные 'мысли' и внутренний мир пользователя. Не выдумывай факты. Твоя задача — дать автору конкретную опору, а не красивую фразу.",
      prompt: planningPrompt,
    });
  } catch (error) {
    console.error("vibecheck planning failed", error);
    return deliverFallback(error);
  }
  const planned = extractJson<RoastPlanPayload>(planRaw)?.candidates ?? [];
  const plans = planned.filter((candidate) =>
    Array.isArray(candidate.basis) && candidate.basis.length >= 2 && Boolean(candidate.observation?.trim())
  );
  plansValidCount = plans.length;
  const duelEvery = Number(process.env.VIBECHECK_DUEL_EVERY ?? "5");
  const clientSupportsDuel = req.headers.get("x-vibecheck-duel") === "1";
  const duelEnabled = clientSupportsDuel && Number.isFinite(duelEvery) && duelEvery > 0 && plans.length >= 2;
  const deliveredSoFar = duelEnabled ? await countDeliveredRuns(sb, owner.ownerKey) : 0;
  const runDuel = duelEnabled && deliveredSoFar % duelEvery === 0;

  // Планировщик мог не вернуть ни одного пригодного кандидата. Редактор
  // выбирает пару сам, но прогон всё равно должен попасть в журнал.
  const chosenPlans = plans.length > 0 ? pickDistinctPlans(plans, runDuel ? 2 : 1) : [null];
  const attempts = await Promise.all(
    chosenPlans.map(async (plan) => ({
      plan,
      variant: await composeRoastVariant({ apiKey, model, planningPrompt, plan }),
    }))
  );

  const broken = attempts.find((attempt) => attempt.variant.error);
  if (broken) return deliverFallback(broken.variant.error);

  const saveAttempt = (attempt: (typeof attempts)[number], outcome: VibeRunOutcome) =>
    saveRun({
      outcome,
      summary: attempt.variant.summary,
      selectedBasis: attempt.variant.basis,
      plannerObservation: attempt.plan?.observation?.trim() ?? null,
      mediaCounts: countItemTypes(attempt.plan?.types ?? []),
      gateHits: Array.from(new Set(attempt.variant.gateHits)),
      retryCount: attempt.variant.retried ? 1 : 0,
    });

  const passing = attempts.filter((attempt) => attempt.variant.ok);
  if (passing.length === 0) {
    await Promise.all(attempts.map((attempt) => saveAttempt(attempt, "rejected_422")));
    return NextResponse.json(
      { error: "сегодня алгоритм не нашел достаточно точную пару. попробуй еще раз — лучше пусто, чем банально." },
      { status: 422 }
    );
  }

  const delivered = await Promise.all(
    passing.map(async (attempt) => ({
      runId: await saveAttempt(attempt, "delivered"),
      persona: attempt.variant.persona,
      summary: attempt.variant.summary,
      basis: attempt.variant.basis,
      highlights: attempt.variant.highlights,
    }))
  );

  const ordered = delivered.length >= 2 && Math.random() < 0.5 ? [delivered[1], delivered[0]] : delivered;
  const leading = ordered[0];

  const duelId =
    ordered.length >= 2 && ordered[0].runId && ordered[1].runId
      ? await recordVibeDuel(sb, {
          ownerKey: owner.ownerKey,
          ownerKind: owner.ownerKind,
          runIdA: ordered[0].runId,
          runIdB: ordered[1].runId,
          shownFirst: ordered[0].runId,
        })
      : null;

  return NextResponse.json({
    itemCount: items.length,
    persona: leading.persona,
    summary: leading.summary,
    basis: leading.basis,
    highlights: leading.highlights,
    runId: leading.runId,
    ...(duelId ? { duel: { id: duelId, variants: ordered } } : {}),
  });
}

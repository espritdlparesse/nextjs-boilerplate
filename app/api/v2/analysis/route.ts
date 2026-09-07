import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildOwnerReadFilter, getEffectiveOwner, getOwnerScope } from "@/lib/ownerLinks";
import { generateFallbackVibecheck } from "@/lib/vibecheckFallback";
import { countDeliveredRuns, recordVibeDuel, recordVibeRun, type VibeRunOutcome } from "@/lib/vibeRuns";
import { countItemTypes, type ItemType } from "@/lib/mediaTypes";
import { blockingGates, observedGates, normalizeRoastNames } from "@/lib/vibeGates";
import { loadTimelineItems, readRange } from "@/lib/vibeItems";
import { trimList } from "@/lib/textLists";
import { buildContextIndex, buildVibeSample, describeItem, describePosition, getCulturalContext, type CulturalContextRow } from "@/lib/vibeContext";

type VibeItem = { type: string; title: string; creator: string | null };

export const runtime = "nodejs";
// The vibecheck makes two editorial model calls in sequence, so the default function window is too short.
export const maxDuration = 60;

// Bump on every edit to the planner or editor instructions below. The holdout compares against it.
const PROMPT_VERSION = "2026-09-06.roast-v3-context";

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

// Пользовательские категории у каждого свои, поэтому прожарка на них не
// строится: в выборку идут только общие типы.
const VIBE_SAMPLE_TYPES: ItemType[] = ["music", "book", "movie"];

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
    highlights: trimList(payload?.highlights, 3),
    basis: trimList(payload?.basis, 3, fallbackBasis),
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
  contextIndex: Map<string, CulturalContextRow>;
}): Promise<RoastVariant> {
  const planBasis = args.plan?.basis?.slice(0, 3) ?? [];
  const pairLine = planBasis.length > 0
    ? planBasis.map((position) => describePosition(position, args.contextIndex)).join("\n")
    : "выбери одну пару из списка";
  const observation = args.plan?.observation?.trim() || "найди одно точное столкновение этих позиций";
  const gateHits: string[] = [];

  const write = async (repair: boolean) => {
    const raw = await createRoastText({
      apiKey: args.apiKey,
      model: args.model,
      instructions: ROAST_EDITOR_INSTRUCTIONS,
      prompt: `${args.planningPrompt}\n\nВыбранная пара, под каждой позицией её проверенная фактура:\n${pairLine}\nНаблюдение редактора: ${observation}${repair ? ROAST_REPAIR_SUFFIX : ""}`,
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

const PLANNER_INSTRUCTIONS =
  "Ты редактор, который сначала ищет материал для короткой прожарки. Не пиши сам вайбчек. Верни только JSON: {candidates:[{basis:string[],types:string[],observation:string}]}. Дай ровно 3 кандидата. В basis укажи две реальные позиции из списка дословно. В types укажи тип каждой позиции в том же порядке: music, book или movie. В каждом кандидате смешивай разные типы медиа, если они есть. Не выбирай одну и ту же пару или одного и того же артиста во всех вариантах. observation — одно простое, проверяемое наблюдение о столкновении именно этих двух позиций: культурная поза, переосмысление названия, видимая социальная или бытовая ситуация. Не пиши про звук, бас, громкость, жанры, атмосферу, ностальгию, абстрактные 'мысли' и внутренний мир пользователя. Не выдумывай факты. Твоя задача — дать автору конкретную опору, а не красивую фразу.";

async function planRoastCandidates(apiKey: string, model: string, planningPrompt: string) {
  const planRaw = await createRoastText({
    apiKey,
    model,
    instructions: PLANNER_INSTRUCTIONS,
    prompt: planningPrompt,
  });
  const planned = extractJson<RoastPlanPayload>(planRaw)?.candidates ?? [];
  return planned.filter(
    (candidate) =>
      Array.isArray(candidate.basis) && candidate.basis.length >= 2 && Boolean(candidate.observation?.trim())
  );
}

async function shouldRunDuel(
  req: NextRequest,
  sb: ReturnType<typeof supabaseAdmin>,
  ownerKey: string,
  planCount: number
) {
  const duelEvery = Number(process.env.VIBECHECK_DUEL_EVERY ?? "5");
  const enabled =
    req.headers.get("x-vibecheck-duel") === "1" && Number.isFinite(duelEvery) && duelEvery > 0 && planCount >= 2;
  if (!enabled) return false;
  return (await countDeliveredRuns(sb, ownerKey)) % duelEvery === 0;
}

type DeliveredVariant = {
  runId: string | null;
  persona: string;
  summary: string;
  basis: string[];
  highlights: string[];
};

async function deliverVibecheck(
  sb: ReturnType<typeof supabaseAdmin>,
  owner: Awaited<ReturnType<typeof getEffectiveOwner>>,
  itemCount: number,
  delivered: DeliveredVariant[]
) {
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
    itemCount,
    persona: leading.persona,
    summary: leading.summary,
    basis: leading.basis,
    highlights: leading.highlights,
    runId: leading.runId,
    ...(duelId ? { duel: { id: duelId, variants: ordered } } : {}),
  });
}

type RoastAttempt = {
  plan: RoastPlan | null;
  variant: Awaited<ReturnType<typeof composeRoastVariant>>;
};

function buildPlanningPrompt(
  vibeSample: VibeItem[],
  contextIndex: Map<string, CulturalContextRow>,
  badFeedback: string[]
) {
  const libraryLines = vibeSample.map((item) => describeItem(item, contextIndex)).join("\n");
  return `Вот выборка из библиотеки. Под позицией с отступом — проверенная фактура о ней: опирайся на неё, но не пересказывай и не называй источник.\n${libraryLines}\n\nПользователь уже забраковал эти формулировки. Не повторяй их приемы и не пересказывай их другими словами:\n${badFeedback.join("\n") || "пока нет"}`;
}

function createRunJournal(
  sb: ReturnType<typeof supabaseAdmin>,
  owner: Awaited<ReturnType<typeof getEffectiveOwner>>,
  model: string,
  items: VibeItem[]
) {
  let plansValidCount = 0;

  function saveRun(fields: {
    outcome: VibeRunOutcome;
    summary?: string | null;
    selectedBasis?: string[];
    plannerObservation?: string | null;
    mediaCounts?: Record<string, number>;
    gateHits?: string[];
    retryCount?: number;
  }) {
    return recordVibeRun(sb, {
      ownerKey: owner.ownerKey,
      ownerKind: owner.ownerKind,
      promptVersion: PROMPT_VERSION,
      model,
      itemCount: items.length,
      plansValidCount,
      ...fields,
    });
  }

  function saveAttempt(attempt: RoastAttempt, outcome: VibeRunOutcome) {
    return saveRun({
      outcome,
      summary: attempt.variant.summary,
      selectedBasis: attempt.variant.basis,
      plannerObservation: attempt.plan?.observation?.trim() ?? null,
      mediaCounts: countItemTypes(attempt.plan?.types ?? []),
      gateHits: Array.from(new Set(attempt.variant.gateHits)),
      retryCount: attempt.variant.retried ? 1 : 0,
    });
  }

  async function deliverFallback(error: unknown) {
    const fallback = generateFallbackVibecheck(items);
    if (!fallback) return vibeGenerationErrorResponse(error);
    const runId = await saveRun({
      outcome: "fallback",
      summary: fallback.summary,
      selectedBasis: fallback.basis,
    });
    return NextResponse.json({ ...fallback, runId });
  }

  return {
    setPlanCount: (count: number) => {
      plansValidCount = count;
    },
    saveAttempt,
    deliverFallback,
  };
}

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const scope = await getOwnerScope(auth);
  const owner = await getEffectiveOwner(auth);
  const body = (await req.json().catch(() => null)) as AnalysisRequestBody | null;
  const sb = supabaseAdmin();
  const { data: items, error } = await loadTimelineItems<VibeItem>(sb, scope, readRange(body), "type, title, creator");

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
  const contextIndex = buildContextIndex(await getCulturalContext(sb, items));
  const badFeedback = await getRecentBadVibes(sb, owner.ownerKey);

  // A vibecheck is the product, not a background summary: use the stronger editor by default.
  const model = process.env.OPENAI_VIBECHECK_MODEL ?? "gpt-4.1";

  const journal = createRunJournal(sb, owner, model, items);

  const libraryLines = vibeSample.map((item) => describeItem(item, contextIndex)).join("\n");
  const planningPrompt = `Вот выборка из библиотеки. Под позицией с отступом — проверенная фактура о ней: опирайся на неё, но не пересказывай и не называй источник.\n${libraryLines}\n\nПользователь уже забраковал эти формулировки. Не повторяй их приемы и не пересказывай их другими словами:\n${badFeedback.join("\n") || "пока нет"}`;
  let plans: RoastPlan[];
  try {
    plans = await planRoastCandidates(apiKey, model, planningPrompt);
  } catch (error) {
    console.error("vibecheck planning failed", error);
    return journal.deliverFallback(error);
  }
  journal.setPlanCount(plans.length);

  const runDuel = await shouldRunDuel(req, sb, owner.ownerKey, plans.length);

  // Планировщик мог не вернуть ни одного пригодного кандидата. Редактор
  // выбирает пару сам, но прогон всё равно должен попасть в журнал.
  const chosenPlans = plans.length > 0 ? pickDistinctPlans(plans, runDuel ? 2 : 1) : [null];
  const attempts = await Promise.all(
    chosenPlans.map(async (plan) => ({
      plan,
      variant: await composeRoastVariant({ apiKey, model, planningPrompt, plan, contextIndex }),
    }))
  );

  const broken = attempts.find((attempt) => attempt.variant.error);
  if (broken) return journal.deliverFallback(broken.variant.error);

  const passing = attempts.filter((attempt) => attempt.variant.ok);
  if (passing.length === 0) {
    await Promise.all(attempts.map((attempt) => journal.saveAttempt(attempt, "rejected_422")));
    return NextResponse.json(
      { error: "сегодня алгоритм не нашел достаточно точную пару. попробуй еще раз — лучше пусто, чем банально." },
      { status: 422 }
    );
  }

  const delivered = await Promise.all(
    passing.map(async (attempt) => ({
      runId: await journal.saveAttempt(attempt, "delivered"),
      persona: attempt.variant.persona,
      summary: attempt.variant.summary,
      basis: attempt.variant.basis,
      highlights: attempt.variant.highlights,
    }))
  );

  return deliverVibecheck(sb, owner, items.length, delivered);
}

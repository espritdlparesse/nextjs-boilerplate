import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getOwnerScope } from "@/lib/ownerLinks";
import { loadTimelineItems, readRange } from "@/lib/vibeItems";
import { trimList } from "@/lib/textLists";

export const runtime = "nodejs";

type AnalysisPayload = {
  summary?: string;
  highlights?: string[];
  basis?: string[];
  recommendations?: string[];
};

type DeepAnalysisRequestBody = {
  from?: number | null;
  to?: number | null;
};

const FREE_DEEP_VIBE_USES = 2;
const DEFAULT_BASIS = ["самые свежие айтемы периода", "повторы артистов и авторов"];
const DEFAULT_HIGHLIGHTS = ["последние айтемы сильнее всего тянут в сторону одного эмоционального мотива"];

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
    .slice(0, 15)
    .map(([creator, meta]) => `${creator} — ${meta.count} (${meta.type}; например, ${meta.sampleTitle})`)
    .join("\n");
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as AnalysisPayload;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as AnalysisPayload;
    } catch {
      return null;
    }
  }
}

async function createWebAwareDeepAnalysis(args: {
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
    max_output_tokens: 1900,
    tools: [{ type: "web_search_preview", search_context_size: "high" }],
    tool_choice: "auto",
  });

  return response.output_text ?? "";
}

export async function GET(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const scope = await getOwnerScope(auth);

  const sb = supabaseAdmin();
  const { count, error } = await sb
    .from("analysis_usage_v2")
    .select("id", { count: "exact", head: true })
    .in("owner_key", scope.readOwnerKeys);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const usesLeft = Math.max(0, FREE_DEEP_VIBE_USES - (count ?? 0));
  return NextResponse.json({
    access: usesLeft > 0 ? "free" : "paywall",
    usesLeft,
    totalFreeUses: FREE_DEEP_VIBE_USES,
  });
}

type DeepItem = {
  type: string;
  title: string;
  creator: string | null;
  consumed_at: string | null;
  created_at: string | null;
  time_origin?: string | null;
};

const ITEM_COLUMNS = "type, title, creator, consumed_at, created_at, time_origin";

function describeItem(item: DeepItem, withOrigin = false) {
  const creator = item.creator ? ` — ${item.creator}` : "";
  const origin = withOrigin && item.time_origin ? ` (${item.time_origin})` : "";
  return `[${item.type}] ${item.title}${creator}${origin}`;
}

function buildMonthlyContext(items: DeepItem[]) {
  const buckets = new Map<string, string[]>();
  for (const item of items) {
    const stamp = item.consumed_at ?? item.created_at;
    const key = stamp
      ? new Date(stamp).toLocaleString("ru-RU", { month: "long", year: "numeric" }).toLowerCase()
      : "без времени";
    const bucket = buckets.get(key) ?? [];
    bucket.push(describeItem(item));
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .slice(0, 6)
    .map(([month, bucket]) => `${month}:\n${bucket.slice(0, 8).join("\n")}`)
    .join("\n\n");
}

async function generateDeepAnalysis(apiKey: string, items: DeepItem[]) {
  const recentItems = items.slice(0, 40).map((item) => describeItem(item, true));
  const olderItems = items.slice(40, 120).map((item) => describeItem(item));
  const monthlyContext = buildMonthlyContext(items);
  const creatorContext = buildCreatorContext(items);

  const model = process.env.OPENAI_DEEP_MODEL ?? "gpt-4.1";
  const raw = await createWebAwareDeepAnalysis({
    apiKey,
    model,
    instructions:
      "Ты пишешь глубокий вайбчек в духе лучших roast-ботов и культурных телеграм-аналитиков, но не как шутку на отъебись, а как реально сильный разбор. Представь, что у roast-бота появился мозг культурного редактора и человеческая глубина психотерапевтического собеседника. Ты не пересказываешь банальности вроде 'этот артист популярен у молодежи', не сюсюкаешь и не ставишь диагнозы. Ты читаешь культурный таймлайн как живую карту сцен, эстетик, мемов, репутаций, интернет-контекста, повторов и эмоциональных состояний. Используй собственное знание культурного контекста произведений, их мемности, статуса, среды и того, как они обычно считываются в интернете и в культуре. Когда это реально усиливает понимание периода, используй веб-поиск, но не трать его на все подряд: ищи контекст по самым повторяющимся авторам, по самым свежим айтемам и по странным, симптоматичным сочетаниям. Не выдумывай факты. Если не уверен, говори вероятностно. Особое внимание уделяй самым последним айтемам: именно они сильнее всего отражают фон текущего момента. Верни только JSON без markdown с полями summary:string, highlights:string[], basis:string[], recommendations:string[]. summary — 2-3 плотных абзаца о том, что человек проживает сейчас, какой у него культурный нерв, что в нем живое, что показное, что тревожное, а что по-настоящему тянет. highlights — 4-6 коротких, но плотных наблюдений: сцены, эстетики, повторяющиеся мотивы, мемные переклички, сильные и слабые места вкуса, скрытые противоречия и предположения о периоде жизни. basis — 2-3 конкретные опоры вывода: какие именно произведения, авторы, сцены или сочетания стали главными доказательствами. recommendations — 3-5 конкретных произведений, книг, фильмов или авторов, которые действительно могут расширить или поддержать этот период; у рекомендаций должен быть ощутимый культурный смысл, а не случайный список. Тон: современный, конкретный, культурно насмотренный, немного колкий, но не злой и не снобский.",
    prompt: `Сделай глубокий вайбчек по этому культурному таймлайну и верни JSON.

Последние айтемы:
${recentItems.join("\n")}

Повторяющиеся авторы и артисты:
${creatorContext || "повторов почти нет"}

Контекст старше:
${olderItems.join("\n")}

По месяцам:
${monthlyContext}`,
  });
  const parsed = extractJson(raw);
  return {
    summary:
      parsed?.summary?.trim() ||
      "в последних айтемах явно есть повторяющийся эмоциональный контур, но ответ модели вернулся не в том формате.",
    highlights: trimList(parsed?.highlights, 6),
    basis: trimList(parsed?.basis, 3),
    recommendations: trimList(parsed?.recommendations, 5),
  };
}


export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const scope = await getOwnerScope(auth);
  const owner = scope.primaryOwner;
  const body = (await req.json().catch(() => null)) as DeepAnalysisRequestBody | null;
  const range = readRange(body);

  const sb = supabaseAdmin();
  const { count: usageCount, error: usageError } = await sb
    .from("analysis_usage_v2")
    .select("id", { count: "exact", head: true })
    .in("owner_key", scope.readOwnerKeys);

  if (usageError) return NextResponse.json({ error: usageError.message }, { status: 500 });
  const usesLeftBeforeRun = Math.max(0, FREE_DEEP_VIBE_USES - (usageCount ?? 0));
  if (usesLeftBeforeRun <= 0) {
    return NextResponse.json(
      { error: "paywall", access: "paywall", usesLeft: 0, totalFreeUses: FREE_DEEP_VIBE_USES },
      { status: 403 }
    );
  }

  const { data: items, error } = await loadTimelineItems<DeepItem>(sb, scope, range, ITEM_COLUMNS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!items || items.length === 0) {
    return NextResponse.json({
      access: "free",
      usesLeft: usesLeftBeforeRun,
      totalFreeUses: FREE_DEEP_VIBE_USES,
      itemCount: 0,
      summary: "пока нечего анализировать. добавь хотя бы несколько треков, книг или фильмов.",
      highlights: ["начни со spotify import", "или добавь что-то вручную"],
      basis: [],
      recommendations: [],
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

  const analysis = await generateDeepAnalysis(apiKey, items);

  const insertUsage = await sb.from("analysis_usage_v2").insert({
    owner_key: owner.ownerKey,
    owner_kind: owner.ownerKind,
  });
  if (insertUsage.error) return NextResponse.json({ error: insertUsage.error.message }, { status: 500 });

  const usesLeft = Math.max(0, usesLeftBeforeRun - 1);
  return NextResponse.json({
    access: "free",
    usesLeft,
    totalFreeUses: FREE_DEEP_VIBE_USES,
    itemCount: items.length,
    summary: analysis.summary,
    basis: analysis.basis.length > 0 ? analysis.basis : DEFAULT_BASIS,
    highlights: analysis.highlights.length > 0 ? analysis.highlights : DEFAULT_HIGHLIGHTS,
    recommendations: analysis.recommendations,
  });
}

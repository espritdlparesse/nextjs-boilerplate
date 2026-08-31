import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildOwnerReadFilter, getOwnerScope } from "@/lib/ownerLinks";

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
  const owner = scope.primaryOwner;

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

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const scope = await getOwnerScope(auth);
  const owner = scope.primaryOwner;
  const body = (await req.json().catch(() => null)) as DeepAnalysisRequestBody | null;
  const from = typeof body?.from === "number" && Number.isFinite(body.from) ? body.from : null;
  const to = typeof body?.to === "number" && Number.isFinite(body.to) ? body.to : null;
  const hasRange = from !== null && to !== null;

  const sb = supabaseAdmin();
  const { count: usageCount, error: usageError } = await sb
    .from("analysis_usage_v2")
    .select("id", { count: "exact", head: true })
    .in("owner_key", scope.readOwnerKeys);

  if (usageError) return NextResponse.json({ error: usageError.message }, { status: 500 });
  const usesLeftBeforeRun = Math.max(0, FREE_DEEP_VIBE_USES - (usageCount ?? 0));
  if (usesLeftBeforeRun <= 0) {
    return NextResponse.json(
      {
        error: "paywall",
        access: "paywall",
        usesLeft: 0,
        totalFreeUses: FREE_DEEP_VIBE_USES,
      },
      { status: 403 }
    );
  }

  let baseQuery = sb
    .from("items")
    .select("type, title, creator, consumed_at, created_at, time_origin")
    .or(buildOwnerReadFilter(scope));
  if (hasRange) {
    baseQuery = baseQuery
      .gte("consumed_at", new Date(from).toISOString())
      .lte("consumed_at", new Date(to).toISOString());
  }

  let { data: items, error } = await baseQuery
    .order("consumed_at", { ascending: false, nullsFirst: false })
    .limit(hasRange ? 1000 : 300);

  if (error?.message?.toLowerCase().includes("consumed_at")) {
    let fallbackQuery = sb
      .from("items")
      .select("type, title, creator, consumed_at, created_at, time_origin")
      .or(buildOwnerReadFilter(scope));
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

  const recentItems = items.slice(0, 40).map((item) => {
    const creator = item.creator ? ` — ${item.creator}` : "";
    return `[${item.type}] ${item.title}${creator}${item.time_origin ? ` (${item.time_origin})` : ""}`;
  });

  const olderItems = items.slice(40, 120).map((item) => {
    const creator = item.creator ? ` — ${item.creator}` : "";
    return `[${item.type}] ${item.title}${creator}`;
  });

  const monthBuckets = new Map<string, string[]>();
  for (const item of items) {
    const timestamp = item.consumed_at
      ? new Date(item.consumed_at).getTime()
      : item.created_at
        ? new Date(item.created_at).getTime()
        : null;
    const key = timestamp
      ? new Date(timestamp).toLocaleString("ru-RU", { month: "long", year: "numeric" }).toLowerCase()
      : "без времени";
    const bucket = monthBuckets.get(key) ?? [];
    bucket.push(`[${item.type}] ${item.title}${item.creator ? ` — ${item.creator}` : ""}`);
    monthBuckets.set(key, bucket);
  }

  const monthlyContext = Array.from(monthBuckets.entries())
    .slice(0, 6)
    .map(([month, bucket]) => `${month}:\n${bucket.slice(0, 8).join("\n")}`)
    .join("\n\n");
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
  const summary =
    parsed?.summary?.trim() ||
    "в последних айтемах явно есть повторяющийся эмоциональный контур, но ответ модели вернулся не в том формате.";
  const highlights = Array.isArray(parsed?.highlights)
    ? parsed.highlights.map((item) => item.trim()).filter(Boolean).slice(0, 6)
    : [];
  const basis = Array.isArray(parsed?.basis)
    ? parsed.basis.map((item) => item.trim()).filter(Boolean).slice(0, 3)
    : [];
  const recommendations = Array.isArray(parsed?.recommendations)
    ? parsed.recommendations.map((item) => item.trim()).filter(Boolean).slice(0, 5)
    : [];

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
    summary,
    basis:
      basis.length > 0
        ? basis
        : ["самые свежие айтемы периода", "повторы артистов и авторов"],
    highlights:
      highlights.length > 0
        ? highlights
        : ["последние айтемы сильнее всего тянут в сторону одного эмоционального мотива"],
    recommendations,
  });
}

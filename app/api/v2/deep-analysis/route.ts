import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type AnalysisPayload = {
  summary?: string;
  highlights?: string[];
  recommendations?: string[];
};

const FREE_DEEP_VIBE_USES = 2;

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

export async function GET(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const sb = supabaseAdmin();
  const { count, error } = await sb
    .from("analysis_usage_v2")
    .select("id", { count: "exact", head: true })
    .eq("owner_key", auth.ownerKey);

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

  const sb = supabaseAdmin();
  const { count: usageCount, error: usageError } = await sb
    .from("analysis_usage_v2")
    .select("id", { count: "exact", head: true })
    .eq("owner_key", auth.ownerKey);

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

  const baseQuery =
    auth.authType === "telegram"
      ? sb
          .from("items")
          .select("type, title, creator, consumed_at, created_at, time_origin")
          .or(`owner_key.eq.${auth.ownerKey},tg_user_id.eq.${auth.legacyTgUserId}`)
      : sb.from("items").select("type, title, creator, consumed_at, created_at, time_origin").eq("owner_key", auth.ownerKey);

  let { data: items, error } = await baseQuery
    .order("consumed_at", { ascending: false, nullsFirst: false })
    .limit(300);

  if (error?.message?.toLowerCase().includes("consumed_at")) {
    const fallback = await baseQuery.order("created_at", { ascending: false }).limit(300);
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

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_DEEP_MODEL ?? "gpt-4.1";

  const response = await client.chat.completions.create({
    model,
    temperature: 0.8,
    max_tokens: 1500,
    messages: [
      {
        role: "system",
        content:
          "Ты внимательный культурный аналитик на стыке психотерапевта, коуча и умного друга. Ты не ставишь диагнозы, а делаешь тонкий срез текущего периода человека по его культурному таймлайну. Особое внимание уделяй самым последним добавленным айтемам: именно они сильнее всего отражают эмоциональный фон настоящего момента. Верни только JSON без markdown с полями summary:string, highlights:string[], recommendations:string[]. summary — 4-6 предложений о том, что человек проживает сейчас, какие темы его тянут, что происходит с эмоциональным фоном и как недавний контент это выдает. highlights — 4-6 коротких конкретных наблюдений про последние айтемы, повторяющиеся темы, скрытые противоречия и предположения о периоде жизни. recommendations — 3-5 конкретных произведений, книг, фильмов или авторов, которые могли бы поддержать, углубить или мягко развернуть этот период. Тон: теплый, внимательный, очень конкретный, культурный, немного ироничный, но без злости.",
      },
      {
        role: "user",
        content: `Сделай глубокий вайбчек по этому культурному таймлайну и верни JSON.

Последние айтемы:
${recentItems.join("\n")}

Контекст старше:
${olderItems.join("\n")}

По месяцам:
${monthlyContext}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const parsed = extractJson(raw);
  const summary =
    parsed?.summary?.trim() ||
    "в последних айтемах явно есть повторяющийся эмоциональный контур, но ответ модели вернулся не в том формате.";
  const highlights = Array.isArray(parsed?.highlights)
    ? parsed.highlights.map((item) => item.trim()).filter(Boolean).slice(0, 6)
    : [];
  const recommendations = Array.isArray(parsed?.recommendations)
    ? parsed.recommendations.map((item) => item.trim()).filter(Boolean).slice(0, 5)
    : [];

  const insertUsage = await sb.from("analysis_usage_v2").insert({
    owner_key: auth.ownerKey,
    owner_kind: auth.ownerKind,
  });
  if (insertUsage.error) return NextResponse.json({ error: insertUsage.error.message }, { status: 500 });

  const usesLeft = Math.max(0, usesLeftBeforeRun - 1);
  return NextResponse.json({
    access: "free",
    usesLeft,
    totalFreeUses: FREE_DEEP_VIBE_USES,
    itemCount: items.length,
    summary,
    highlights:
      highlights.length > 0
        ? highlights
        : ["последние айтемы сильнее всего тянут в сторону одного эмоционального мотива"],
    recommendations,
  });
}

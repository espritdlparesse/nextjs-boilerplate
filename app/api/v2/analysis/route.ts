import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type AnalysisPayload = {
  summary?: string;
  highlights?: string[];
};

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

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const sb = supabaseAdmin();
  const query =
    auth.authType === "telegram"
      ? sb
          .from("items")
          .select("type, title, creator")
          .or(`owner_key.eq.${auth.ownerKey},tg_user_id.eq.${auth.legacyTgUserId}`)
          .order("created_at", { ascending: false })
      : sb
          .from("items")
          .select("type, title, creator")
          .eq("owner_key", auth.ownerKey)
          .order("created_at", { ascending: false });

  const { data: items, error } = await query.limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!items || items.length === 0) {
    return NextResponse.json({
      itemCount: 0,
      summary: "пока нечего анализировать. добавь хотя бы несколько треков, книг или фильмов.",
      highlights: ["начни со spotify import", "или добавь что-то вручную"],
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

  const lines = items.map((item) => {
    const creator = item.creator ? ` — ${item.creator}` : "";
    return `[${item.type}] ${item.title}${creator}`;
  });

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const response = await client.chat.completions.create({
    model,
    temperature: 0.8,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content:
          "Ты делаешь короткий, умный и теплый вайбчек культурного вкуса. Верни только JSON без markdown с полями summary:string и highlights:string[]. Highlights должно быть 4-6 коротких пунктов на русском.",
      },
      {
        role: "user",
        content: `Проанализируй этот список контента и верни JSON.\n\n${lines.join("\n")}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const parsed = extractJson(raw);
  const summary =
    parsed?.summary?.trim() ||
    `в библиотеке ${items.length} айтемов. чувствуется устойчивый культурный паттерн, но ответ модели вернулся не в том формате.`;
  const highlights = Array.isArray(parsed?.highlights)
    ? parsed.highlights.map((item) => item.trim()).filter(Boolean).slice(0, 6)
    : [];

  return NextResponse.json({
    itemCount: items.length,
    summary,
    highlights:
      highlights.length > 0
        ? highlights
        : ["многое держится вокруг повторяющихся авторов и артистов", "у вкуса уже есть понятный эмоциональный контур"],
  });
}

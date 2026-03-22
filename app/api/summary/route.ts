import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveApiIdentity } from "@/lib/auth";
import { buildOwnerReadFilter, getOwnerScope } from "@/lib/ownerLinks";

export const runtime = "nodejs";

function buildRoastPrompt(items: Array<any>) {
  const lines = items.slice(0, 120).map((it) => {
    const creator = it.creator ? ` — ${it.creator}` : "";
    const src = it.source ? ` (${it.source})` : "";
    return `- [${it.type}] ${it.title}${creator}${src}`;
  });

  const instructions = `
Напиши короткий вайбчек по библиотеке.

Формат:
- только 2-4 плотных предложения
- без отдельных блоков рекомендаций
- без стрелок, списков и markdown

Тон:
- наблюдательно, остро, культурно
- чуть колко, но не по-хамски
- конкретно называй паттерны и отдельные названия из списка
- это бесплатный быстрый вайбчек, а не глубокий разбор
`.trim();

  return {
    instructions,
    input: `Список контента:\n${lines.join("\n")}`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = resolveApiIdentity(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    const scope = await getOwnerScope(auth);

    const sb = supabaseAdmin();
    const query = sb
      .from("items")
      .select("id,tg_user_id,type,source,title,creator,created_at,updated_at,owner_key")
      .or(buildOwnerReadFilter(scope));

    const { data: items, error } = await query.order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!items || items.length === 0) {
      return NextResponse.json(
        {
          summary:
            "Пока нечего анализировать: у вас нет items. Добавьте хотя бы пару книг/фильмов/треков — и я сделаю выводы.",
        },
        { status: 200 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });
    const prompt = buildRoastPrompt(items);

    // gpt-4o — быстрая, умная, существующая модель
    const model = process.env.OPENAI_MODEL ?? "gpt-4o";

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: prompt.instructions },
        { role: "user", content: prompt.input },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const summary = response.choices[0]?.message?.content ?? "";

    return NextResponse.json({ summary });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "unknown error";
    const status =
      msg.startsWith("tg auth failed") || msg.includes("tg user") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveApiIdentity } from "@/lib/auth";
import { buildOwnerReadFilter, getOwnerScope } from "@/lib/ownerLinks";

export const runtime = "nodejs";

function buildProfessorPrompt(items: Array<any>) {
  const lines = items.slice(0, 80).map((it) => {
    const creator = it.creator ? ` — ${it.creator}` : "";
    const src = it.source ? ` (${it.source})` : "";
    return `- [${it.type}] ${it.title}${creator}${src}`;
  });

  const instructions = `
Сначала напиши 2-3 предложения прожарки. Каждое — про одну категорию из списка (музыка, книги, фильмы). Пропусти категорию если её нет.

Тон прожарки: коротко, конкретно, чуть злее чем надо. Никаких метафор — только факт и укол. Называй конкретные названия из списка.

Затем с новой строки напиши блок рекомендаций — по одной на каждую категорию которая есть в списке. Начни строго с фразы «мне кажется, тебе ещё могло бы понравиться (или уже нравится!):», потом перечисли через запятую. Перед блоком напиши «→».

Рекомендации должны быть реально существующими и актуальными — проверяй что называешь реальные книги, альбомы, фильмы которые точно существуют. Подбирай близкое по духу к тому что уже есть в списке.

Пример формата (не копируй содержимое):
Музыка вся грустная. Книги умные, но их три за год. Фильмов нет — это не минимализм.

→ мне кажется, тебе ещё могло бы понравиться (или уже нравится!): Grouper «Ruins», Беккет «Моллой», Клэр Дени «Белый материал»

Правила:
- Простые короткие предложения
- Разговорный русский
- Никаких эмодзи
- Рекомендации должны логично вытекать из вкуса — не случайные, а похожие или расширяющие
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
    const prompt = buildProfessorPrompt(items);

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

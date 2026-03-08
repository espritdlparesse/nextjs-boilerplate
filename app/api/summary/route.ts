import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTelegramInitData } from "@/lib/telegram";

export const runtime = "nodejs";

function getTgUserIdOrThrow(req: NextRequest) {
  const initData = req.headers.get("x-telegram-init-data") ?? "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (process.env.NODE_ENV === "production") {
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN missing");
    const verified = verifyTelegramInitData(initData, botToken);
    if (!verified.ok) throw new Error(`tg auth failed: ${verified.reason}`);
    const tgUserId = verified.user?.id;
    if (!tgUserId) throw new Error("tg user missing");
    return Number(tgUserId);
  }

  if (initData && botToken) {
    const verified = verifyTelegramInitData(initData, botToken);
    if (verified.ok && verified.user?.id) return Number(verified.user.id);
  }

  const devId = process.env.DEV_TG_USER_ID;
  if (!devId) {
    throw new Error(
      "No Telegram init data. Set DEV_TG_USER_ID in .env.local to test locally."
    );
  }
  return Number(devId);
}

function buildProfessorPrompt(items: Array<any>) {
  const lines = items.slice(0, 80).map((it) => {
    const creator = it.creator ? ` — ${it.creator}` : "";
    const src = it.source ? ` (${it.source})` : "";
    return `- [${it.type}] ${it.title}${creator}${src}`;
  });

  const instructions = `
Сначала напиши 2-3 предложения прожарки. Каждое — про одну категорию из списка (музыка, книги, фильмы). Пропусти категорию если её нет.

Тон прожарки: коротко, конкретно, чуть злее чем надо. Никаких метафор — только факт и укол. Называй конкретные названия из списка.

Затем с новой строки напиши блок рекомендаций — по одной на каждую категорию которая есть в списке. Начни с короткой фразы-перехода (типа «тебе может понравиться» / «на основе этого попробуй» / «раз уж такой вкус»), потом через тире — названия. Перед блоком напиши «→».

Пример формата (не копируй содержимое):
Музыка вся грустная. Книги умные, но их три за год. Фильмов нет — это не минимализм.

→ раз уж так — Grouper «Ruins», Беккет «Моллой», Клэр Дени «Белый материал»

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
    const tgUserId = getTgUserIdOrThrow(req);

    const sb = supabaseAdmin();
    const { data: items, error } = await sb
      .from("items")
      .select("id,tg_user_id,type,source,title,creator,created_at,updated_at")
      .eq("tg_user_id", tgUserId)
      .order("created_at", { ascending: false });

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
      temperature: 0.85,
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

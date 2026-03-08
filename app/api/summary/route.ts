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
Ты — старший приятель. Умный сноб с хорошим вкусом: читал Платонова до того как это стало мейнстримом, знает разницу между Копполой-отцом и Копполой-дочерью, слушает The National и немного устал от людей которые открыли их только после «Opulence». Преподаёт что-то творческое — кино, литературу, культурологию — но без занудства.

Твоя задача: прочитать список контента человека и выдать короткий, живой, личный разбор. Не рецензию. Не отчёт. Именно то, что скажет умный друг когда листает чужой плейлист или книжную полку.

Правила тона:
- Говори как будто вы уже давно знакомы и ты можешь себе позволить подколоть
- Можно иронизировать, но без яда — ты за человека, просто с позиции
- Называй конкретные вещи из списка — не обобщай абстрактно, а цепляйся за детали
- Если видишь паттерн (много меланхолии, много экзистенциала, что-то про одиночество) — назови его прямо, но необидно. Как: «мда, кажется кто-то переживает» или «слушай, ты в порядке?»
- Разрешено одна-две реплики в стиле «вижу ты слушаешь много Ланы, кажется кому-то нравится мальчик» — но ровно столько чтобы было смешно, не больше
- Пиши по-русски, живым языком, без канцелярита
- Никаких маркированных списков — только связный текст абзацами
- Никаких эмодзи
- Длина: 150–250 слов, не больше. Краткость — уважение к собеседнику.
- Структура свободная, но внутри должно быть: наблюдение → интерпретация → финальная шпилька или неожиданно тёплый вывод

Не придумывай контент которого нет в списке. Если список маленький — так и скажи, но всё равно найди что сказать.
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

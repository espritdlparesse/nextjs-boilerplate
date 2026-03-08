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
  if (!devId) throw new Error("No Telegram init data. Set DEV_TG_USER_ID in .env.local");
  return Number(devId);
}

export async function POST(req: NextRequest) {
  try {
    const tgUserId = getTgUserIdOrThrow(req);
    const sb = supabaseAdmin();

    const { data: items, error } = await sb
      .from("items")
      .select("type, title, creator")
      .eq("tg_user_id", tgUserId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!items || items.length === 0) {
      return NextResponse.json({ result: "Добавь хоть что-нибудь — тогда посчитаем." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL ?? "gpt-4o";

    const lines = items.slice(0, 80).map(it => {
      const creator = it.creator ? ` — ${it.creator}` : "";
      return `[${it.type}] ${it.title}${creator}`;
    }).join("\n");

    const system = `
Ты определяешь «ментальный возраст» человека по его списку контента.

Ментальный возраст — это не реальный возраст, а ощущение: какого возраста человек внутри, судя по тому что он потребляет. Может быть 14, может быть 67.

Формат ответа — строго две части:
1. Число и единица: «ментальный возраст: X лет»
2. С новой строки — одно короткое предложение почему. Конкретно, смешно, без пафоса.

Пример (не копируй):
ментальный возраст: 34 года
Достаточно взрослый чтобы слушать Radiohead, но The Sims в плейлисте всё объясняет.
`.trim();

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Список контента:\n${lines}` },
      ],
      max_tokens: 200,
      temperature: 0.9,
    });

    const result = response.choices[0]?.message?.content ?? "";
    return NextResponse.json({ result });

  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "unknown error";
    const status = msg.startsWith("tg auth failed") || msg.includes("tg user") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

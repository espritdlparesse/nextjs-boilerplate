import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTelegramInitData } from "@/lib/telegram";

export const runtime = "nodejs";

const FREE_USES = 3;

function getTgUserOrThrow(req: NextRequest) {
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
  if (!devId) throw new Error("No Telegram init data");
  return Number(devId);
}

export async function GET(req: NextRequest) {
  try {
    const tgUserId = getTgUserOrThrow(req);
    const sb = supabaseAdmin();

    const { data: forever } = await sb
      .from("purchases")
      .select("id")
      .eq("tg_user_id", tgUserId)
      .eq("product", "deep_vibe_forever")
      .limit(1);

    if (forever && forever.length > 0) {
      return NextResponse.json({ access: "forever", usesLeft: null });
    }

    const { count } = await sb
      .from("deep_vibe_usage")
      .select("id", { count: "exact", head: true })
      .eq("tg_user_id", tgUserId);

    const usesLeft = Math.max(0, FREE_USES - (count ?? 0));
    return NextResponse.json({ access: usesLeft > 0 ? "free" : "none", usesLeft });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tgUserId = getTgUserOrThrow(req);
    const sb = supabaseAdmin();

    const body = await req.json().catch(() => ({}));
    const paymentChargeId = body?.payment_charge_id ?? null;

    // Проверяем вечную подписку
    const { data: forever } = await sb
      .from("purchases")
      .select("id")
      .eq("tg_user_id", tgUserId)
      .eq("product", "deep_vibe_forever")
      .limit(1);

    const hasForever = forever && forever.length > 0;

    if (!hasForever) {
      if (paymentChargeId) {
        // Разовая покупка — проверяем что она есть
        const { data: purchase } = await sb
          .from("purchases")
          .select("id")
          .eq("tg_user_id", tgUserId)
          .eq("product", "deep_vibe_once")
          .eq("telegram_payment_charge_id", paymentChargeId)
          .limit(1);

        if (!purchase || purchase.length === 0) {
          return NextResponse.json({ error: "payment_not_found" }, { status: 403 });
        }
      } else {
        // Бесплатная попытка
        const { count } = await sb
          .from("deep_vibe_usage")
          .select("id", { count: "exact", head: true })
          .eq("tg_user_id", tgUserId);

        if ((count ?? 0) >= FREE_USES) {
          return NextResponse.json({ error: "no_access", usesLeft: 0 }, { status: 403 });
        }

        await sb.from("deep_vibe_usage").insert({ tg_user_id: tgUserId });
      }
    }

    const { data: items, error } = await sb
      .from("items")
      .select("type, title, creator")
      .eq("tg_user_id", tgUserId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!items || items.length === 0) {
      return NextResponse.json({ result: "Добавь хоть что-нибудь сначала." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL ?? "gpt-4o";

    const lines = items.slice(0, 100).map((it: any) => {
      const creator = it.creator ? ` — ${it.creator}` : "";
      return `[${it.type}] ${it.title}${creator}`;
    }).join("\n");

    const system = `
Ты внимательный и тёплый аналитик культурных предпочтений. Тебе дан список контента человека — книги, музыка, фильмы.

Напиши глубокий личный анализ в 4-5 абзацах. Структура:

1. **Общий портрет** — какой человек вырисовывается из этого набора? Какие ценности, какой внутренний мир? Будь конкретным, называй произведения.

2. **Эмоциональный фон** — какие эмоции и состояния прослеживаются? Есть ли тревога, ностальгия, поиск смысла, желание сбежать, влюблённость, злость? Что преобладает?

3. **Паттерны и противоречия** — что повторяется? Есть ли неожиданные сочетания? Что это может говорить о внутреннем конфликте или поиске?

4. **Что это может значить сейчас** — осторожная, но честная интерпретация. Не диагноз, но наблюдение. Что человек, возможно, переживает или ищет в этот период жизни?

5. **Рекомендации** — 5-7 конкретных произведений которые могут резонировать или дать что-то новое. С коротким объяснением почему именно это.

Тон: тёплый, честный, без пафоса и без сюсюканья. Как будто говорит очень умный близкий друг который много читал и смотрел. Пиши на русском, разговорно.
`.trim();

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Список контента:\n${lines}` },
      ],
      max_tokens: 2000,
      temperature: 0.8,
    });

    const result = response.choices[0]?.message?.content ?? "";
    return NextResponse.json({ result });

  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "unknown error";
    const status = msg.includes("tg auth") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

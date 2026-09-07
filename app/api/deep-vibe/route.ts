import { errorMessage } from "@/lib/text";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveApiIdentity } from "@/lib/auth";
import { buildOwnerReadFilter, getOwnerScope } from "@/lib/ownerLinks";
import { verifyTelegramInitData, getTgUserIdOrThrow } from "@/lib/telegram";

export const runtime = "nodejs";

const FREE_USES = 3;

export async function GET(req: NextRequest) {
  try {
    const tgUserId = getTgUserIdOrThrow(req);
    const sb = supabaseAdmin();

    // Вечная подписка?
    const { data: forever } = await sb
      .from("purchases")
      .select("id")
      .eq("tg_user_id", tgUserId)
      .eq("product", "deep_vibe_forever")
      .limit(1);

    if (forever && forever.length > 0) {
      return NextResponse.json({ access: "forever", usesLeft: null });
    }

    // Сколько бесплатных использовано?
    const { count } = await sb
      .from("deep_vibe_usage")
      .select("id", { count: "exact", head: true })
      .eq("tg_user_id", tgUserId);

    const usesLeft = Math.max(0, FREE_USES - (count ?? 0));
    if (usesLeft > 0) {
      return NextResponse.json({ access: "free", usesLeft });
    }

    // Есть неиспользованная разовая покупка?
    // Считаем: покупок минус использований после бесплатных
    const { count: paidCount } = await sb
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("tg_user_id", tgUserId)
      .eq("product", "deep_vibe_once");

    const { count: totalUsage } = await sb
      .from("deep_vibe_usage")
      .select("id", { count: "exact", head: true })
      .eq("tg_user_id", tgUserId);

    const paidUsesLeft = (paidCount ?? 0) - Math.max(0, (totalUsage ?? 0) - FREE_USES);

    if (paidUsesLeft > 0) {
      return NextResponse.json({ access: "paid", usesLeft: paidUsesLeft });
    }

    return NextResponse.json({ access: "none", usesLeft: 0 });

  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

async function consumeDeepVibeUse(sb: ReturnType<typeof supabaseAdmin>, tgUserId: number) {
  const { data: forever } = await sb
    .from("purchases")
    .select("id")
    .eq("tg_user_id", tgUserId)
    .eq("product", "deep_vibe_forever")
    .limit(1);
  if (forever && forever.length > 0) return true;

  const { count: totalUsage } = await sb
    .from("deep_vibe_usage")
    .select("id", { count: "exact", head: true })
    .eq("tg_user_id", tgUserId);
  const used = totalUsage ?? 0;

  if (used >= FREE_USES) {
    const { count: paidCount } = await sb
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("tg_user_id", tgUserId)
      .eq("product", "deep_vibe_once");
    if ((paidCount ?? 0) - (used - FREE_USES) <= 0) return false;
  }

  await sb.from("deep_vibe_usage").insert({ tg_user_id: tgUserId });
  return true;
}

async function writeDeepVibe(apiKey: string, items: Array<{ type: string; title: string; creator: string | null }>) {
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  const lines = items.slice(0, 100).map((it) => {
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

  return response.choices[0]?.message?.content ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const tgUserId = getTgUserIdOrThrow(req);
    const auth = resolveApiIdentity(req);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
    const scope = await getOwnerScope(auth);
    const sb = supabaseAdmin();

    const body = await req.json().catch(() => ({}));
    const paymentChargeId = body?.payment_charge_id ?? null;

    if (!(await consumeDeepVibeUse(sb, tgUserId))) {
      return NextResponse.json({ error: "no_access", usesLeft: 0 }, { status: 403 });
    }

    const { data: items, error } = await sb
      .from("items")
      .select("type, title, creator")
      .or(buildOwnerReadFilter(scope))
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
    if (!items || items.length === 0) {
      return NextResponse.json({ result: "Добавь хоть что-нибудь сначала." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

    const result = await writeDeepVibe(apiKey, items);
    return NextResponse.json({ result });

  } catch (e) {
    const msg = errorMessage(e, "unknown error");
    const status = msg.includes("tg auth") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

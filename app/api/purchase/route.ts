import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTelegramInitData, getTgUserIdOrThrow } from "@/lib/telegram";

export const runtime = "nodejs";

// Цены в звёздах
export const PRICES = {
  deep_vibe_once: 5,
  deep_vibe_forever: 200,
};

// POST /api/purchase — записать покупку после успешной оплаты звёздами
export async function POST(req: NextRequest) {
  try {
    const tgUserId = getTgUserIdOrThrow(req);
    const body = await req.json().catch(() => null);

    if (!body?.product || !body?.telegram_payment_charge_id) {
      return NextResponse.json({ error: "product and telegram_payment_charge_id required" }, { status: 400 });
    }

    const { product, telegram_payment_charge_id, stars_amount } = body;

    if (!["deep_vibe_once", "deep_vibe_forever"].includes(product)) {
      return NextResponse.json({ error: "unknown product" }, { status: 400 });
    }

    const sb = supabaseAdmin();

    const { error } = await sb.from("purchases").insert({
      tg_user_id: tgUserId,
      product,
      telegram_payment_charge_id,
      stars_amount: stars_amount ?? PRICES[product as keyof typeof PRICES],
    });

    if (error) {
      // Дубликат — уже записано
      if (error.code === "23505") {
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

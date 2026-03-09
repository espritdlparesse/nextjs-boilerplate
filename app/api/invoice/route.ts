import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram";

export const runtime = "nodejs";

const PRODUCTS = {
  deep_vibe_once: {
    title: "Глубокий вайбчек",
    description: "Один детальный анализ твоего ментального состояния по контенту",
    stars: 5,
  },
  deep_vibe_forever: {
    title: "Глубокий вайбчек — вечный доступ",
    description: "Неограниченное количество глубоких вайбчеков навсегда",
    stars: 200,
  },
};

export async function GET(req: NextRequest) {
  try {
    const initData = req.headers.get("x-telegram-init-data") ?? "";
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return NextResponse.json({ error: "bot token missing" }, { status: 500 });

    const verified = verifyTelegramInitData(initData, botToken);
    if (!verified.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const product = req.nextUrl.searchParams.get("product") as keyof typeof PRODUCTS;
    const productInfo = PRODUCTS[product];
    if (!productInfo) return NextResponse.json({ error: "unknown product" }, { status: 400 });

    // Создаём инвойс через Telegram Bot API
    const res = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: productInfo.title,
        description: productInfo.description,
        payload: JSON.stringify({ product, tg_user_id: verified.user?.id }),
        currency: "XTR", // Telegram Stars
        prices: [{ label: productInfo.title, amount: productInfo.stars }],
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json({ error: data.description }, { status: 500 });
    }

    return NextResponse.json({ url: data.result });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

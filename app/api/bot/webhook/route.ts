import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();

    // pre_checkout_query — Telegram просит подтвердить платёж, всегда говорим ok
    if (update.pre_checkout_query) {
      await answerPreCheckoutQuery(update.pre_checkout_query.id, true);
      return NextResponse.json({ ok: true });
    }

    // successful_payment — платёж прошёл
    if (update.message?.successful_payment) {
      const msg = update.message;
      const payment = msg.successful_payment;
      const tgUserId = msg.from.id;
      const tgUsername = msg.from.username ?? null;

      // payload содержит JSON: { product, tg_user_id }
      let product = "deep_vibe_once";
      try {
        const parsed = JSON.parse(payment.invoice_payload);
        product = parsed.product ?? "deep_vibe_once";
      } catch {
        product = payment.invoice_payload; // fallback — строка напрямую
      }

      const sb = supabaseAdmin();
      await sb.from("purchases").upsert({
        tg_user_id: tgUserId,
        product,
        stars_amount: payment.total_amount,
        telegram_payment_charge_id: payment.telegram_payment_charge_id,
      }, { onConflict: "telegram_payment_charge_id" });

      // Сообщение пользователю
      const text = product === "deep_vibe_forever"
        ? "✨ Оплата прошла! Вечный доступ к вайбчеку без прикола активирован. Открой приложение."
        : "✨ Оплата прошла! Открой приложение и нажми «вайбчек без прикола».";

      await sendMessage(tgUserId, text);
      return NextResponse.json({ ok: true });
    }

    // /paysupport — обязательная команда для публикации в каталоге Telegram
    if (update.message?.text === "/paysupport") {
      const chatId = update.message.chat.id;
      await sendMessage(chatId,
        "💬 Поддержка по оплате\n\n" +
        "Если у тебя возникли проблемы с оплатой через Telegram Stars — напиши нам: @espritdlparesse\n\n" +
        "Мы разберёмся и вернём Stars если что-то пошло не так."
      );
      return NextResponse.json({ ok: true });
    }

    // /start — приветствие
    if (update.message?.text?.startsWith("/start")) {
      const chatId = update.message.chat.id;
      const firstName = update.message.from?.first_name ?? "there";
      await sendMessage(chatId,
        `👋 Hey, ${firstName}!\n\nevery you is your personal tracker for music, books, and movies.\n\nAdd what you're listening to, reading, and watching — and get a vibe check: an AI analysis of your taste.\n\n👇 Open the app`,
        { reply_markup: { inline_keyboard: [[{ text: "open every you →", web_app: { url: "https://everyyou-mvp.vercel.app" } }]] } }
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("webhook error:", e?.message);
    return NextResponse.json({ ok: true }); // всегда 200 для Telegram
  }
}

async function answerPreCheckoutQuery(id: string, ok: boolean, errorMessage?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const body: any = { pre_checkout_query_id: id, ok };
  if (!ok && errorMessage) body.error_message = errorMessage;
  await fetch(`https://api.telegram.org/bot${token}/answerPreCheckoutQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendMessage(chatId: number, text: string, extra?: Record<string, any>) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...extra }),
  });
}

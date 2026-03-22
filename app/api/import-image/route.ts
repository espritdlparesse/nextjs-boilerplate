import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { verifyTelegramInitData } from "@/lib/telegram";

export const runtime = "nodejs";

function getInitData(req: NextRequest) {
  return req.headers.get("x-telegram-init-data") ?? "";
}

function authTg(req: NextRequest) {
  const initData = getInitData(req);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return { ok: false as const, status: 500, message: "TELEGRAM_BOT_TOKEN missing" };
  }

  const verified = verifyTelegramInitData(initData, botToken);

  if (!verified.ok) {
    return { ok: false as const, status: 401, message: `tg auth failed: ${verified.reason}` };
  }

  const tgUserId = verified.user?.id;
  if (!tgUserId) {
    return { ok: false as const, status: 401, message: "tg user missing" };
  }

  return { ok: true as const, tgUserId: Number(tgUserId) };
}

type ImportedItem = {
  type: "music" | "book" | "movie";
  source: "spotify" | "goodreads" | "letterboxd" | "manual";
  title: string;
  creator: string | null;
};

function clampItems(items: any[]): ImportedItem[] {
  if (!Array.isArray(items)) return [];
  const out: ImportedItem[] = [];

  for (const it of items.slice(0, 80)) {
    const type = String(it?.type ?? "").toLowerCase();
    const source = String(it?.source ?? "").toLowerCase();
    const title = String(it?.title ?? "").trim();

    // creator: берём из creator / author / artist, fallback — пустая строка
    const rawCreator =
      it?.creator ?? it?.author ?? it?.artist ?? null;
    const creator =
      rawCreator == null ? null : String(rawCreator).trim() || null;

    if (!title) continue;
    if (!["music", "book", "movie"].includes(type)) continue;

    const src = (["spotify", "goodreads", "letterboxd"].includes(source)
      ? source
      : "manual") as ImportedItem["source"];

    out.push({
      type: type as ImportedItem["type"],
      source: src,
      title,
      creator,
    });
  }

  return out;
}

function safeParseJson(text: string) {
  // Убираем markdown-обёртку если есть
  const stripped = text.replace(/```json|```/g, "").trim();

  // Пробуем весь текст
  try {
    return JSON.parse(stripped);
  } catch {}

  // Ищем первый объект {...}
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {}
  }

  return null;
}

export async function POST(req: NextRequest) {
  const auth = authTg(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "bad form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file is required (multipart field name: file)" },
      { status: 400 }
    );
  }

  if (!file.type?.startsWith("image/")) {
    return NextResponse.json({ error: "only image/* supported" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "image too large (max 10MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  const client = new OpenAI({ apiKey });

  const model =
    process.env.OPENAI_VISION_MODEL ??
    process.env.OPENAI_MODEL ??
    "gpt-4o";

  const systemPrompt = `
Ты помощник, который импортирует культурный контент по изображению.

Изображение может быть чем угодно: скриншот сервиса, фото книжного шкафа, фото обложки книги в магазине, постер фильма, экран Spotify, полка с книгами или винилом.

Определи, что на изображении (Spotify / Goodreads / Letterboxd / другое) и извлеки список элементов.

ВАЖНО: названия и авторы на скриншоте часто обрезаны (например "Матч По...", "реж. Вуд..."). 
В таких случаях ты ОБЯЗАН восстановить полное название и автора по контексту — используй свои знания о фильмах, книгах, музыке.
Например "Матч По..." + "2005" + "Триллер, Драма" → title: "Match Point", creator: "Вуди Аллен".
Никогда не оставляй обрезанное название с "..." в поле title — всегда восстанавливай полное.

Верни ТОЛЬКО валидный JSON без комментариев и без markdown.

Формат строго такой:

{
  "detectedType": "music" | "book" | "movie" | "unknown",
  "detectedSource": "spotify" | "goodreads" | "letterboxd" | "manual",
  "confidence": number,
  "items": [
    { "type": "music"|"book"|"movie", "source": "spotify"|"goodreads"|"letterboxd"|"manual", "title": string, "creator": string|null }
  ],
  "warnings": string[]
}

Для поля creator — всегда заполняй если знаешь: режиссёр для фильмов, автор для книг, исполнитель для музыки.
Максимум 80 элементов.
`.trim();

  let outputText = "";

  try {
    const resp = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Распознай это изображение и верни JSON." },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "auto" },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0,
    });

    outputText = resp.choices[0]?.message?.content ?? "";
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "openai error" },
      { status: 500 }
    );
  }

  const parsed = safeParseJson(outputText);

  if (!parsed) {
    return NextResponse.json(
      { error: "failed to parse model output", raw: outputText.slice(0, 2000) },
      { status: 500 }
    );
  }

  const detectedType = String(parsed.detectedType ?? "unknown").toLowerCase();
  const detectedSource = String(parsed.detectedSource ?? "manual").toLowerCase();
  const confidence = Number(parsed.confidence ?? 0);

  const items = clampItems(parsed.items ?? []);
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.map((x: any) => String(x))
    : [];

  return NextResponse.json({
    detectedType: ["music", "book", "movie"].includes(detectedType)
      ? detectedType
      : "unknown",
    detectedSource: ["spotify", "goodreads", "letterboxd"].includes(detectedSource)
      ? detectedSource
      : "manual",
    confidence: Number.isFinite(confidence) ? confidence : 0,
    items,
    warnings,
  });
}

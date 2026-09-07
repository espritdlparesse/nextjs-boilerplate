import { errorMessage } from "@/lib/text";
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

type RawModelItem = {
  type?: unknown;
  source?: unknown;
  title?: unknown;
  creator?: unknown;
  author?: unknown;
  artist?: unknown;
};

function clampItems(items: RawModelItem[]): ImportedItem[] {
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

const SYSTEM_PROMPT = `
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

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ITEM_TYPES = ["music", "book", "movie"];
const KNOWN_SOURCES = ["spotify", "goodreads", "letterboxd"];

function pickOne(value: unknown, allowed: string[], fallback: string) {
  const normalized = String(value ?? fallback).toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function checkImage(file: FormDataEntryValue | null): File | NextResponse {
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required (multipart field name: file)" }, { status: 400 });
  }
  if (!file.type?.startsWith("image/")) {
    return NextResponse.json({ error: "only image/* supported" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "image too large (max 10MB)" }, { status: 400 });
  }
  return file;
}

async function toDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

async function readImage(client: OpenAI, model: string, dataUrl: string) {
  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Распознай это изображение и верни JSON." },
          { type: "image_url", image_url: { url: dataUrl, detail: "auto" } },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0,
  });
  return resp.choices[0]?.message?.content ?? "";
}

function visionModel() {
  return process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o";
}

function shapeImportResponse(outputText: string) {
  const parsed = safeParseJson(outputText);
  if (!parsed) {
    return NextResponse.json(
      { error: "failed to parse model output", raw: outputText.slice(0, 2000) },
      { status: 500 }
    );
  }

  const confidence = Number(parsed.confidence ?? 0);
  return NextResponse.json({
    detectedType: pickOne(parsed.detectedType, ITEM_TYPES, "unknown"),
    detectedSource: pickOne(parsed.detectedSource, KNOWN_SOURCES, "manual"),
    confidence: Number.isFinite(confidence) ? confidence : 0,
    items: clampItems(parsed.items ?? []),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map((value: unknown) => String(value)) : [],
  });
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
  if (!form) return NextResponse.json({ error: "bad form data" }, { status: 400 });

  const file = checkImage(form.get("file"));
  if (file instanceof NextResponse) return file;

  const dataUrl = await toDataUrl(file);

  let outputText: string;
  try {
    outputText = await readImage(new OpenAI({ apiKey }), visionModel(), dataUrl);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "openai error") }, { status: 500 });
  }

  return shapeImportResponse(outputText);
}

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildOwnerReadFilter, getOwnerScope } from "@/lib/ownerLinks";

export const runtime = "nodejs";

type AnalysisPayload = {
  persona?: string;
  hook?: string;
  body?: string;
  closer?: string;
  summary?: string;
  highlights?: string[];
  basis?: string[];
};

type AnalysisRequestBody = {
  from?: number | null;
  to?: number | null;
};

function buildCreatorContext(
  items: Array<{ creator: string | null; title: string; type: string }>
) {
  const counts = new Map<string, { count: number; sampleTitle: string; type: string }>();

  for (const item of items) {
    const creator = item.creator?.trim();
    if (!creator) continue;
    const key = creator.toLowerCase();
    const current = counts.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    counts.set(key, { count: 1, sampleTitle: item.title, type: item.type });
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 12)
    .map(([creator, meta]) => `${creator} — ${meta.count} (${meta.type}; например, ${meta.sampleTitle})`)
    .join("\n");
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as AnalysisPayload;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as AnalysisPayload;
    } catch {
      return null;
    }
  }
}

function looksTooCorporate(text: string) {
  const normalized = text.toLowerCase();
  const bannedPhrases = [
    "контентный срез",
    "демонстрирует",
    "сочетает в себе",
    "говорит о",
    "свидетельствует",
    "современный вкус",
    "молодежного восприятия",
    "молодежной аудитории",
    "наводит на размышления",
    "отражает тенденции",
    "указывает на",
    "варьируется",
    "представленная треками",
    "поиск глубины",
    "популярной культуры",
    "развлекательном контенте",
    "смешивать развлечения",
    "сложных философских размышлений",
    "этапы на пути к самопознанию",
    "присутствует",
    "список контента",
    "эклектичный вкус",
    "популярность",
  ];

  return bannedPhrases.some((phrase) => normalized.includes(phrase));
}

function looksTooAbstract(text: string) {
  const normalized = text.toLowerCase();
  const abstractSignals = [
    "культура",
    "контент",
    "аудитория",
    "динамика",
    "восприятие",
    "тенденции",
    "традиции",
    "современность",
    "самопознание",
    "разнообразие",
  ];
  const hitCount = abstractSignals.filter((signal) => normalized.includes(signal)).length;
  return hitCount >= 3;
}

function shouldRetryAnalysis(summary: string, highlights: string[], basis: string[]) {
  const combined = [summary, ...highlights, ...basis].join("\n");
  return looksTooCorporate(combined) || looksTooAbstract(summary);
}

function looksTooSoft(summary: string) {
  const normalized = summary.toLowerCase();
  const softSignals = [
    "в целом",
    "кажется",
    "можно заметить",
    "присутствует",
    "сочетание",
    "балансирует",
    "вызывает ассоциации",
    "начиная с",
    "заканчивая",
  ];
  return softSignals.some((signal) => normalized.includes(signal));
}

function looksTooComplicated(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("как будто") || normalized.includes("несмотря на то")) return true;

  return text
    .split(/[.!?]+/)
    .some((sentence) => sentence.trim().split(/\s+/).filter(Boolean).length > 22);
}

function looksTooGenericRoast(text: string) {
  const normalized = text.toLowerCase();
  const genericSignals = [
    "тебе нравится",
    "уличный вайб",
    "странная ностальгия",
    "ностальгия в обручальной",
    "свежие релизы",
    "эклектич",
    "атмосфера",
    "разброс",
  ];

  return genericSignals.some((signal) => normalized.includes(signal));
}

async function createWebAwareAnalysis(args: {
  apiKey: string;
  model: string;
  prompt: string;
  instructions: string;
}) {
  const client = new OpenAI({ apiKey: args.apiKey });

  const response = await client.responses.create({
    model: args.model,
    instructions: args.instructions,
    input: args.prompt,
    max_output_tokens: 1100,
    tools: [{ type: "web_search_preview", search_context_size: "medium" }],
    tool_choice: "auto",
  });

  return response.output_text ?? "";
}

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const scope = await getOwnerScope(auth);
  const body = (await req.json().catch(() => null)) as AnalysisRequestBody | null;
  const from = typeof body?.from === "number" && Number.isFinite(body.from) ? body.from : null;
  const to = typeof body?.to === "number" && Number.isFinite(body.to) ? body.to : null;
  const hasRange = from !== null && to !== null;

  const sb = supabaseAdmin();
  let baseQuery = sb.from("items").select("type, title, creator").or(buildOwnerReadFilter(scope));
  if (hasRange) {
    baseQuery = baseQuery
      .gte("consumed_at", new Date(from).toISOString())
      .lte("consumed_at", new Date(to).toISOString());
  }

  let { data: items, error } = await baseQuery
    .order("consumed_at", { ascending: false, nullsFirst: false })
    .limit(hasRange ? 1000 : 300);

  if (error?.message?.toLowerCase().includes("consumed_at")) {
    let fallbackQuery = sb.from("items").select("type, title, creator").or(buildOwnerReadFilter(scope));
    if (hasRange) {
      fallbackQuery = fallbackQuery
        .gte("created_at", new Date(from).toISOString())
        .lte("created_at", new Date(to).toISOString());
    }
    const fallback = await fallbackQuery.order("created_at", { ascending: false }).limit(hasRange ? 1000 : 300);
    items = fallback.data;
    error = fallback.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!items || items.length === 0) {
    return NextResponse.json({
      itemCount: 0,
      summary: "пока нечего анализировать. добавь хотя бы несколько треков, книг или фильмов.",
      highlights: ["начни со spotify import", "или добавь что-то вручную"],
      basis: [],
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

  const lines = items.map((item) => {
    const creator = item.creator ? ` — ${item.creator}` : "";
    return `[${item.type}] ${item.title}${creator}`;
  });
  const recentLines = lines.slice(0, 40).join("\n");
  const creatorContext = buildCreatorContext(items);

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const prompt = `Сделай вайбчек по этому списку и верни JSON.

Последние и самые заметные айтемы:
${recentLines}

Повторяющиеся авторы и артисты:
${creatorContext || "повторов почти нет"}

Общий список:
${lines.slice(0, 120).join("\n")}`;

  const raw = await createWebAwareAnalysis({
    apiKey,
    model,
    instructions:
      "Ты пишешь обычный вайбчек по библиотеке. Это короткая прожарка в простом, разговорном стиле: как одно точное наблюдение из телеграм-канала, а не как культурный разбор. Говори на 'ты'. Сначала выбери две или три позиции, которые действительно противоречат друг другу по стилю, репутации, настроению или аудитории. Не выбирай просто похожие любимые вещи. Затем строй вайбчек вокруг этой пары, а не вокруг всей библиотеки. Лучший результат обычно состоит из двух коротких строк. Первая называет пару. Она может быть вопросом, но не должна всегда начинаться с вопроса: чередуй 'вижу Bladee и Софию Копполу.', 'сегодня у тебя Bladee рядом с Софией Копполой.' и вопросительные начала. Вторая строка дает легкую характеристику вкуса или осторожное наблюдение о периоде. Называя артистов и авторов, всегда используй привычную русскую передачу имен: 'биг бейби тейп', 'авраам руссо', 'джастин тимберлейк'. Не используй латиницу для имен исполнителей, если имя можно нормально написать по-русски. Примеры формы: 'Bladee и София Коппола? набор эстета в депрессии, жму руку.', 'Ого, Bladee и София Коппола. кажется, у кого-то была непростая неделя.', '«Я обязательно уволюсь» и Lovestoned? похоже, ты решила уволиться из отношений. рабочих или романтических.', '«Комната Вагинова» и «Канистра»? похоже, сегодня хотелось грязи.' или 'Ого, «Ученичество, или Книга наслаждений» и SexyBack вместе! круто, когда во время духовного роста в перерывах можно потанцевать.' Не копируй эти фразы дословно и не используй их как заготовку. Если у айтемов есть общая узнаваемая фактура, называй ее прямо одним понятным словом. Лучше 'сегодня хотелось грязи', чем пустое описание формы вроде 'хотелось чего-то тесного и громкого'. Можно сделать острее двумя способами: переиначить название произведения ('«Фрагменты речи влюбленного»? скорее фрагменты речи того, кто боится говорить о своих чувствах.') или уколоть видимую культурную позу, сцену, статусную фантазию или отношение к привилегии ('«Наследники» и Fleetwood Mac? тебе нравится критиковать богатых, пока это красиво снято.'). Целью критики должна быть эстетическая поза, а не врожденная идентичность человека. Не угадывай и не высмеивай расу, гендерную идентичность, сексуальность, религию, национальность, инвалидность, возраст или класс пользователя по библиотеке. Если список это поддерживает, используй мягкое противоречие: назови внешнее качество, а затем скрытое человеческое напряжение. Пример: 'тебе, кажется, нравится, когда все красиво, но никому не хорошо'. Это не лозунг и не шаблон: используй его только при реальной опоре на айтемы. Текст должен быть простым: короткие фразы, один смысл, без сложного синтаксиса. Каждая строка должна быть понятна сразу, без расшифровки частной метафоры. Ответ недействителен, если после удаления имен артистов он подходит к любой другой случайной паре. Вторая строка обязана добавлять конкретную бытовую сцену, социальную позу или неожиданный вывод, который реально следует из этих двух имен. Нельзя просто назвать два жанра, «вайб», «ностальгию», «атмосферу» или сказать 'тебе нравится X и Y'. Не используй англоязычную конструкцию панча и пустые пары слов вроде 'и кризис, и припев'. Не прикрепляй человеческое действие к абстракции ради контраста: можно танцевать во время духовного роста, но нельзя танцевать под духовный рост. Если игра слов не складывается в ясную русскую мысль, убери ее. Не объясняй шутку и не пытайся быть остроумным в каждой строке. Ирония не обязательна. Лучше тихое, немного неловкое наблюдение, чем громкий панч. Неправильно: 'список контента балансирует на грани', 'музыка вызывает ассоциации', 'в целом сочетание', 'книги исследуют', 'фильмы варьируются', 'это указывает на', 'это говорит о'. Не пиши как культуролог, психолог, редактор медиа или школьный отличник. Не используй слова 'контент', 'аудитория', 'тенденции', 'современность', 'поп-культура', 'самопознание', 'восприятие', 'разнообразие'. Не описывай жанры и не пересказывай, кто популярен. Не давай рекомендации, не ставь диагнозы, не пиши 'красный флаг'. Не приписывай человеку скрытые мотивы или поведение, которых библиотека не может показать: нельзя писать 'поэтому ты молчишь', 'тебе никто не нужен' или 'ты боишься'. Легкий вывод о настроении выбранного периода допустим, если он прямо поддержан айтемами. Не выдумывай факты. Не копируй мемные шаблоны и готовые формулы из чужих каналов. Не заканчивай текст большой литературной фразой, лозунгом или нарочито умной игрой слов. В полном тексте можно использовать не больше одного сравнения и нельзя строить фразы по схеме 'ты делаешь X, как будто Y'. Верни только JSON без markdown с полями persona:string, hook:string, body:string, closer:string, highlights:string[], basis:string[]. persona — короткий ярлык на 2-5 простых слов. hook — первая строка с двумя или тремя айтемами, до 16 слов. body — вторая строка до 20 слов. closer — пустая строка, если первые две уже работают; иначе до 12 слов. highlights — 3 короткие реплики на 'ты', каждая до 12 слов и без новой темы. basis — именно те 2-3 позиции, на которых держится вывод.",
    prompt,
  });

  let parsed = extractJson(raw);
  let persona = parsed?.persona?.trim() || "";
  let hook = parsed?.hook?.trim() || "";
  let bodyText = parsed?.body?.trim() || "";
  let closer = parsed?.closer?.trim() || "";
  let summary =
    parsed?.summary?.trim() ||
    `в библиотеке ${items.length} айтемов. чувствуется устойчивый культурный паттерн, но ответ модели вернулся не в том формате.`;
  let highlights = Array.isArray(parsed?.highlights)
    ? parsed.highlights.map((item) => item.trim()).filter(Boolean).slice(0, 6)
    : [];
  let basis = Array.isArray(parsed?.basis)
    ? parsed.basis.map((item) => item.trim()).filter(Boolean).slice(0, 3)
    : [];

  if (
    shouldRetryAnalysis(summary, highlights, basis) ||
    looksTooSoft(summary) ||
    looksTooComplicated([hook, bodyText, closer, ...highlights].join(" ")) ||
    looksTooGenericRoast([hook, bodyText, closer, ...highlights].join(" ")) ||
    !hook ||
    !bodyText
  ) {
    const retryRaw = await createWebAwareAnalysis({
      apiKey,
      model,
      instructions:
        "Ты уже один раз написал слишком сложно или слишком общо. Перепиши вайбчек как короткое наблюдение из хорошего телеграм-канала. Простые слова. Две короткие строки. Сначала выбери две или три позиции, которые действительно противоречат друг другу по стилю, репутации или настроению. Первая строка называет эту пару. Вторая строка дает конкретную бытовую сцену, социальную позу или неожиданный вывод, который работает только с этой парой. Нельзя просто назвать «вайб», «ностальгию», «атмосферу» или написать 'тебе нравится X и Y'. Если после удаления имен артистов текст подходит любой случайной паре, он плохой. Пиши имена артистов привычной русской передачей, без латиницы: 'биг бейби тейп', 'авраам руссо', 'джастин тимберлейк'. Формы: 'Блейди и София Коппола? набор эстета в депрессии, жму руку.' или 'Ого, Блейди и София Коппола. кажется, у кого-то была непростая неделя.' Не копируй примеры дословно. Можно переиначить название произведения или уколоть видимую культурную позу, статусную фантазию и отношение к привилегии. Не критикуй и не угадывай по библиотеке расу, гендерную идентичность, сексуальность, религию, национальность, инвалидность, возраст или класс пользователя. Каждая строка должна быть понятна сразу. Не используй англоязычный ритм панча и пустые пары слов вроде 'и кризис, и припев'. Не объясняй вывод. Не строй сравнения одно на другом. Никакой статьи про культуру и никаких рекомендаций. Запрещены конструкции: 'список балансирует', 'музыка вызывает ассоциации', 'в целом это сочетание', 'можно заметить', 'представленная здесь музыка', 'книги исследуют', 'фильмы варьируются', 'это говорит о', 'это указывает на'. Хороший пример: 'вижу Блейди и Зебальда. кажется, ты выбираешь вещи, где кому-то так же плохо, как иногда тебе'. Плохой пример: 'эклектичный вкус сочетает популярную музыку с философской литературой'. Не используй конструкцию 'ты делаешь X, как будто Y', мемные шаблоны, лозунги или нарочито умные финальные фразы. Верни только JSON без markdown с полями persona:string, hook:string, body:string, closer:string, highlights:string[], basis:string[]. persona — 2-5 простых слов. hook — первая строка до 16 слов. body — вторая строка до 20 слов. closer — пустая строка, если первые две уже работают; иначе до 12 слов. highlights — 3 короткие реплики на 'ты', без новых тем. basis — только те 2-3 конкретные позиции, на которых держится вывод.",
      prompt: `${prompt}

Сейчас особенно важно: сначала найди одно главное противоречие вкуса и строй текст только вокруг него. Не пиши академически. Не пиши абзац как сочинение. Пиши как короткую устную оценку.`,
    });
    const retryParsed = extractJson(retryRaw);
    if (retryParsed) {
      parsed = retryParsed;
      persona = retryParsed.persona?.trim() || persona;
      hook = retryParsed.hook?.trim() || hook;
      bodyText = retryParsed.body?.trim() || bodyText;
      closer = retryParsed.closer?.trim() || closer;
      summary =
        retryParsed.summary?.trim() ||
        summary;
      highlights = Array.isArray(retryParsed.highlights)
        ? retryParsed.highlights.map((item) => item.trim()).filter(Boolean).slice(0, 6)
        : highlights;
      basis = Array.isArray(retryParsed.basis)
        ? retryParsed.basis.map((item) => item.trim()).filter(Boolean).slice(0, 3)
        : basis;
    }
  }

  const combinedSummary = [hook, bodyText || summary, closer].filter(Boolean).join(" ");

  return NextResponse.json({
    itemCount: items.length,
    persona,
    summary: combinedSummary,
    basis:
      basis.length > 0
        ? basis
        : ["последние айтемы периода", "повторяющиеся артисты и авторы"],
    highlights:
      highlights.length > 0
        ? highlights
        : ["многое держится вокруг повторяющихся авторов и артистов", "у вкуса уже есть понятный эмоциональный контур"],
  });
}

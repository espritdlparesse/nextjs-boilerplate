import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTelegramInitData } from "@/lib/telegram";
import { isAdminTgId } from "@/lib/admins";
import { CONSTRUCTIONS, FLAWS, OTHER_LABEL, collectLabels, describeTaxonomy, type FormLabel } from "@/lib/vibeForms";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 20;

type ClassifierResponse = {
  runs?: Array<{ index?: number; construction?: unknown; flaws?: unknown; note?: unknown }>;
};

const INSTRUCTIONS = [
  "Ты размечаешь готовые вайбчеки по форме. Не оценивай, смешно ли, и не переписывай текст.",
  "Для каждого текста выбери ровно одну конструкцию и перечисли изъяны, которые в нём есть.",
  "Бери только метки из списков.",
  `Если ничего из списка не подходит, ставь ${OTHER_LABEL} и коротко опиши в note, что там на самом деле.`,
  `Не растягивай метку, чтобы она подошла: ${OTHER_LABEL} полезнее неверной метки.`,
  "Если изъянов нет, верни пустой массив.",
  "",
  "Конструкции:",
  describeTaxonomy(CONSTRUCTIONS),
  "",
  "Изъяны:",
  describeTaxonomy(FLAWS),
  "",
  'Верни только JSON: {runs:[{index:number,construction:string,flaws:string[],note:string}]}. index — номер текста из запроса. note оставь пустым, если other не понадобился.',
].join("\n");

function requireAdmin(req: NextRequest) {
  const verified = verifyTelegramInitData(
    req.headers.get("x-telegram-init-data") ?? "",
    process.env.TELEGRAM_BOT_TOKEN!
  );
  return verified.ok && isAdminTgId(verified.user?.id);
}

function parseRuns(raw: string) {
  const match = raw.trim().match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    return (JSON.parse(match[0]) as ClassifierResponse).runs ?? [];
  } catch {
    return [];
  }
}

async function classify(apiKey: string, model: string, summaries: string[]) {
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model,
    instructions: INSTRUCTIONS,
    input: summaries.map((summary, index) => `${index}. ${summary}`).join("\n\n"),
    max_output_tokens: 1200,
  });
  return parseRuns(response.output_text ?? "");
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

  const sb = supabaseAdmin();
  const { data: runs, error } = await sb
    .from("vibe_runs")
    .select("id, summary")
    .is("form_labeled_at", null)
    .not("summary", "is", null)
    .neq("outcome", "fallback")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!runs || runs.length === 0) return NextResponse.json({ labeled: 0, remaining: 0 });

  const classified = await classify(
    apiKey,
    process.env.OPENAI_CLASSIFIER_MODEL ?? "gpt-4.1-mini",
    runs.map((run) => run.summary as string)
  );

  const labels: FormLabel[] = [];
  for (const entry of classified) {
    const run = typeof entry.index === "number" ? runs[entry.index] : undefined;
    if (run) labels.push(...collectLabels(run.id, entry));
  }

  if (labels.length > 0) {
    await sb.from("vibe_forms").upsert(
      labels.map((label) => ({ run_id: label.runId, label: label.label, kind: label.kind, note: label.note })),
      { onConflict: "run_id,label,kind" }
    );
  }

  // Штампуем всю партию, а не только размеченные: иначе текст, на котором
  // классификатор молчит, будет возвращаться в каждую следующую партию.
  await sb
    .from("vibe_runs")
    .update({ form_labeled_at: new Date().toISOString() })
    .in("id", runs.map((run) => run.id));

  const { count } = await sb
    .from("vibe_runs")
    .select("id", { count: "exact", head: true })
    .is("form_labeled_at", null)
    .not("summary", "is", null)
    .neq("outcome", "fallback");

  return NextResponse.json({ labeled: runs.length, labels: labels.length, remaining: count ?? 0 });
}

// Поверхность для ворот согласия: размеченные тексты рядом с их метками,
// чтобы сверить полсотни штук руками.
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "50"), 200);
  const { data, error } = await supabaseAdmin()
    .from("vibe_runs")
    .select("id, summary, outcome, gate_hits, vibe_forms(label, kind, note)")
    .not("form_labeled_at", "is", null)
    .order("form_labeled_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: data ?? [] });
}

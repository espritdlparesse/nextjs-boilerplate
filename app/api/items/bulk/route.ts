import { errorMessage } from "@/lib/text";
import { NextRequest, NextResponse } from "next/server";
import { buildOwnerReadFilter, getOwnerScope, ownerColumns, type EffectiveOwner, type OwnerScope } from "@/lib/ownerLinks";
import { itemIdentityKey } from "@/lib/itemIdentity";
import { normalizeLegacySource } from "@/lib/itemSources";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { safeTimelineIsoFromMs } from "@/lib/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS_PER_REQUEST = 5000;
const INSERT_CHUNK = 500;

/**
 * DEBUG ping:
 * Можно дернуть в браузере (не в Telegram) и увидеть, что роут живой.
 * В Telegram всё равно будет POST с auth.
 */
type ItemRow = ReturnType<typeof toItemRow>;

type RawBulkItem = {
  type?: unknown;
  source?: unknown;
  title?: unknown;
  creator?: unknown;
  consumedAt?: unknown;
  timeOrigin?: unknown;
};

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toItemRow(item: RawBulkItem, owner: EffectiveOwner) {
  return {
    ...ownerColumns(owner),
    type: asText(item?.type),
    source: normalizeLegacySource(item?.source),
    title: asText(item?.title),
    creator: asText(item?.creator) || null,
    consumed_at: safeTimelineIsoFromMs(typeof item?.consumedAt === "number" ? item.consumedAt : null),
    time_origin: typeof item?.timeOrigin === "string" ? item.timeOrigin : null,
  };
}

type StoredItem = { type: string; title: string; creator: string | null };

async function loadStoredKeys(sb: ReturnType<typeof supabaseAdmin>, scope: OwnerScope) {
  const pageSize = 1000;
  const stored = new Set<string>();

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from("items")
      .select("type,title,creator")
      .or(buildOwnerReadFilter(scope))
      .range(from, from + pageSize - 1);

    if (error) return { stored: null, error };
    for (const row of (data ?? []) as StoredItem[]) stored.add(itemIdentityKey(row));
    if (!data || data.length < pageSize) return { stored, error: null };
  }
}

async function insertRows(sb: ReturnType<typeof supabaseAdmin>, rows: ItemRow[]) {
  let inserted = 0;

  for (let from = 0; from < rows.length; from += INSERT_CHUNK) {
    const { data, error } = await sb
      .from("items")
      .insert(rows.slice(from, from + INSERT_CHUNK))
      .select("id");

    if (error) return { inserted, error };
    inserted += data?.length ?? 0;
  }

  return { inserted, error: null };
}

function keepNewRows(rows: ItemRow[], stored: Set<string>) {
  return rows.filter((row) => {
    const key = itemIdentityKey(row);
    if (stored.has(key)) return false;
    stored.add(key);
    return true;
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/items/bulk" });
}

export async function POST(req: NextRequest) {
  try {
    const auth = resolveApiIdentity(req);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
    const scope = await getOwnerScope(auth);

    const body = await req.json().catch(() => null);
    const items = body?.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items[] is required" }, { status: 400 });
    }

    if (items.length > MAX_ITEMS_PER_REQUEST) {
      return NextResponse.json(
        { error: `items[] holds ${items.length}, the limit is ${MAX_ITEMS_PER_REQUEST}` },
        { status: 400 }
      );
    }

    const rows = items.map((item: RawBulkItem) => toItemRow(item, scope.primaryOwner));
    if (rows.some((row: ItemRow) => !row.type || !row.source || !row.title)) {
      return NextResponse.json({ error: "each item must include type, source, title" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { stored, error: storedError } = await loadStoredKeys(sb, scope);
    if (!stored) return NextResponse.json({ error: errorMessage(storedError) }, { status: 500 });

    const fresh = keepNewRows(rows, stored);
    const skipped = rows.length - fresh.length;

    if (fresh.length === 0) return NextResponse.json({ ok: true, inserted: 0, skipped });

    const { inserted, error } = await insertRows(sb, fresh);

    if (error) return NextResponse.json({ error: errorMessage(error), inserted }, { status: 500 });

    return NextResponse.json({ ok: true, inserted, skipped });
  } catch (e) {
    const msg = errorMessage(e, "unknown error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

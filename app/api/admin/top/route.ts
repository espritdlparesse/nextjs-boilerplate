import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/admins";

export const runtime = "nodejs";

type Identity = { username: string | null; firstName: string | null; lastName: string | null; lastSeen: string | null };

function countByOwner(rows: Array<{ owner_key: string | null; tg_user_id: number | string | null }>) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const id = row.owner_key || `tg:${String(row.tg_user_id)}`;
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function readString(props: Record<string, unknown>, key: string) {
  return typeof props[key] === "string" ? (props[key] as string) : null;
}

function latestIdentities(rows: Array<{ owner_key: string | null; created_at: string | null; properties: unknown }>) {
  const byOwner = new Map<string, Identity>();
  for (const row of rows) {
    if (!row.owner_key || byOwner.has(row.owner_key)) continue;
    const props = (row.properties ?? {}) as Record<string, unknown>;
    byOwner.set(row.owner_key, {
      username: readString(props, "tgUsername"),
      firstName: readString(props, "tgFirstName"),
      lastName: readString(props, "tgLastName"),
      lastSeen: row.created_at ?? null,
    });
  }
  return byOwner;
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("items")
    .select("owner_key,tg_user_id");

  if (error || !data) return NextResponse.json([], { status: 200 });

  const counts = countByOwner(data);
  const { data: events } = await sb
    .from("app_events")
    .select("owner_key,created_at,properties")
    .eq("owner_kind", "telegram")
    .order("created_at", { ascending: false })
    .limit(5000);
  const identities = latestIdentities(events ?? []);

  const top = Object.entries(counts)
    .map(([owner_key, count]) => {
      const identity = identities.get(owner_key);
      return {
        owner_key,
        tg_user_id: owner_key.startsWith("tg:") ? owner_key.slice(3) : owner_key,
        count,
        username: identity?.username ?? null,
        first_name: identity?.firstName ?? null,
        last_name: identity?.lastName ?? null,
        last_seen: identity?.lastSeen ?? null,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json(top);
}

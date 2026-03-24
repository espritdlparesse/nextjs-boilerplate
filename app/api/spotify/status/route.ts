import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveApiIdentity } from "@/lib/auth";
import { buildOwnerReadFilter, getEffectiveOwner, getOwnerScope } from "@/lib/ownerLinks";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const owner = await getEffectiveOwner(auth);

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("spotify_connections")
    .select("spotify_user_id, spotify_display_name, expires_at")
    .eq("owner_key", owner.ownerKey)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    connected: Boolean(data?.spotify_user_id),
    profile: data
      ? {
          id: data.spotify_user_id,
          displayName: data.spotify_display_name,
          expiresAt: data.expires_at,
        }
      : null,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const owner = await getEffectiveOwner(auth);
  const scope = await getOwnerScope(auth);
  const sb = supabaseAdmin();

  const url = new URL(req.url);
  const queryDeleteContent = url.searchParams.get("deleteContent");
  const body = (await req.json().catch(() => null)) as { deleteContent?: boolean } | null;
  const deleteContent = body?.deleteContent === true || queryDeleteContent === "1" || queryDeleteContent === "true";

  const { error: connectionError } = await sb
    .from("spotify_connections")
    .delete()
    .eq("owner_key", owner.ownerKey);

  if (connectionError) {
    return NextResponse.json({ error: connectionError.message }, { status: 500 });
  }

  let deletedItems = 0;
  if (deleteContent) {
    const { data, error } = await sb
      .from("items")
      .delete()
      .in("source", ["spotify", "import_spotify"])
      .or(buildOwnerReadFilter(scope))
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    deletedItems = data?.length ?? 0;
  }

  return NextResponse.json({ ok: true, disconnected: true, deletedItems });
}

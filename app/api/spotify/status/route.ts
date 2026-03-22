import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveApiIdentity } from "@/lib/auth";
import { getEffectiveOwner } from "@/lib/ownerLinks";

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

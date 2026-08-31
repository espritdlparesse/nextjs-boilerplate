import { NextRequest, NextResponse } from "next/server";
import { resolveApiIdentity } from "@/lib/auth";
import { getEffectiveOwner } from "@/lib/ownerLinks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "нужна картинка" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "картинка должна быть до 5 мб" }, { status: 400 });

  const owner = await getEffectiveOwner(auth);
  const objectPath = `${owner.ownerKey.replace(/[^a-zA-Z0-9_-]/g, "_")}/avatar-${Date.now()}.${extensionFor(file)}`;
  const sb = supabaseAdmin();
  const { error: uploadError } = await sb.storage.from("profile-avatars").upload(objectPath, await file.arrayBuffer(), {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  const { data: publicUrl } = sb.storage.from("profile-avatars").getPublicUrl(objectPath);
  const avatarUrl = publicUrl.publicUrl;
  const { error: profileError } = await sb.from("profile_settings").upsert({
    owner_key: owner.ownerKey,
    owner_kind: owner.ownerKind,
    avatar_url: avatarUrl,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_key" });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  return NextResponse.json({ avatarUrl });
}

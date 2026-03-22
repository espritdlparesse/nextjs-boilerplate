import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getTgUserId(req: NextRequest): number | null {
  try {
    const initData = req.headers.get("x-telegram-init-data") ?? "";
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (userStr) {
      const user = JSON.parse(decodeURIComponent(userStr));
      return user?.id ?? null;
    }
    // Dev fallback
    if (process.env.NODE_ENV === "development") return 394657396;
    return null;
  } catch { return null; }
}

// GET /api/custom-categories — список категорий пользователя
export async function GET(req: NextRequest) {
  const tgUserId = getTgUserId(req);
  if (!tgUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("custom_categories")
    .select("id, name, emoji, created_at")
    .eq("tg_user_id", tgUserId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data ?? [] });
}

// POST /api/custom-categories — создать категорию (только для платных)
export async function POST(req: NextRequest) {
  const tgUserId = getTgUserId(req);
  if (!tgUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = getSupabase();

  // Проверяем что у пользователя есть покупка deep_vibe_forever
  const { data: purchase } = await supabase
    .from("purchases")
    .select("id")
    .eq("tg_user_id", tgUserId)
    .eq("product", "deep_vibe_forever")
    .maybeSingle();

  // Также проверяем ADMIN
  const isAdmin = String(tgUserId) === process.env.ADMIN_TG_ID;

  if (!purchase && !isAdmin) {
    return NextResponse.json({ error: "requires_pro", message: "Кастомные категории доступны с подпиской" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  const emoji = (body.emoji ?? "📌").trim() || "📌";

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (name.length > 40) return NextResponse.json({ error: "название слишком длинное" }, { status: 400 });

  // Лимит: не более 20 категорий на пользователя
  const { count } = await supabase
    .from("custom_categories")
    .select("id", { count: "exact", head: true })
    .eq("tg_user_id", tgUserId);

  if ((count ?? 0) >= 20) {
    return NextResponse.json({ error: "максимум 20 категорий" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("custom_categories")
    .insert({ tg_user_id: tgUserId, name, emoji })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}

// DELETE /api/custom-categories?id=uuid — удалить категорию
export async function DELETE(req: NextRequest) {
  const tgUserId = getTgUserId(req);
  if (!tgUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = getSupabase();

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("custom_categories")
    .delete()
    .eq("id", id)
    .eq("tg_user_id", tgUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

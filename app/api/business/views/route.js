import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { safeGetUser } from "@/lib/auth/safeGetUser";

export async function POST(request) {
  const supabase = await createSupabaseServerClient();
  let payload = null;

  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const businessId = payload?.businessId;
  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  }

  const { user } = await safeGetUser(supabase);

  if (user?.id && user.id === businessId) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { error } = await supabase
    .from("business_views")
    .insert({ business_id: businessId, viewer_id: user?.id ?? null });

  if (error) {
    return NextResponse.json(
      { error: "Failed to record view" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

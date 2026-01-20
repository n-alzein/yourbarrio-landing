import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req) {
  const { userId } = await req.json();

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service key not configured" },
      { status: 500 }
    );
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

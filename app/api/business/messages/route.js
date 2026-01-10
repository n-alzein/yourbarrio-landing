import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { fetchMessages } from "@/lib/messages";

export async function GET(request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  const before = searchParams.get("before");
  const limitValue = searchParams.get("limit");
  const limit = limitValue ? Number(limitValue) : undefined;

  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
  }

  const { data: convo, error: convoError } = await supabase
    .from("conversations")
    .select("business_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convoError) {
    return NextResponse.json(
      { error: convoError.message || "Failed to validate conversation" },
      { status: 500 }
    );
  }

  if (!convo || convo.business_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const messages = await fetchMessages({
      supabase,
      conversationId,
      before: before || null,
      limit,
    });
    const response = NextResponse.json({ messages }, { status: 200 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Failed to load messages" },
      { status: 500 }
    );
  }
}

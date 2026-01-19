import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { safeGetUser } from "@/lib/auth/safeGetUser";
import { fetchConversationById, fetchConversations } from "@/lib/messages";

export async function GET(request) {
  const supabase = await createSupabaseServerClient();
  const { user, error: userError } = await safeGetUser(supabase);

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");

  try {
    if (conversationId) {
      const conversation = await fetchConversationById({
        supabase,
        conversationId,
      });

      if (!conversation) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      if (conversation.business_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const response = NextResponse.json({ conversation }, { status: 200 });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const conversations = await fetchConversations({
      supabase,
      userId: user.id,
      role: "business",
    });
    const response = NextResponse.json({ conversations }, { status: 200 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Failed to load conversations" },
      { status: 500 }
    );
  }
}

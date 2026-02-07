import { NextResponse } from "next/server";
import { getBusinessDataClientForRequest } from "@/lib/business/getBusinessDataClientForRequest";
import { fetchConversationById, fetchConversations } from "@/lib/messages";

export async function GET(request) {
  const access = await getBusinessDataClientForRequest();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const supabase = access.client;
  const effectiveUserId = access.effectiveUserId;

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

      if (conversation.business_id !== effectiveUserId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const response = NextResponse.json({ conversation }, { status: 200 });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const conversations = await fetchConversations({
      supabase,
      userId: effectiveUserId,
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

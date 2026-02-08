import { NextResponse } from "next/server";
import { fetchConversationById, fetchConversations } from "@/lib/messages";
import { getSupportAwareClient } from "@/lib/support/supportAwareData";

export async function GET(request) {
  let clientBundle = null;
  try {
    clientBundle = await getSupportAwareClient({
      expectedRole: "customer",
      feature: "customer-conversations",
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { client: supabase, effectiveUserId } = clientBundle;

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

      if (conversation.customer_id !== effectiveUserId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const response = NextResponse.json({ conversation }, { status: 200 });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const conversations = await fetchConversations({
      supabase,
      userId: effectiveUserId,
      role: "customer",
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

import { NextResponse } from "next/server";
import { getBusinessDataClientForRequest } from "@/lib/business/getBusinessDataClientForRequest";
import {
  fetchConversationById,
  fetchConversationOrderContext,
  fetchConversations,
  fetchMessagePage,
} from "@/lib/messages";

export async function GET(request) {
  const access = await getBusinessDataClientForRequest();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const supabase = access.client;
  const effectiveUserId = access.effectiveUserId;

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  const includeInitialThread = searchParams.get("includeInitialThread") === "1";
  const selectedConversationId = searchParams.get("selectedConversationId") || "";
  const initialThreadLimitValue = searchParams.get("initialThreadLimit");
  const initialThreadLimit = initialThreadLimitValue
    ? Number(initialThreadLimitValue)
    : undefined;

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

      const orderContext = await fetchConversationOrderContext({
        supabase,
        conversationId,
      });

      const response = NextResponse.json(
        { conversation, orderContext },
        { status: 200 }
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const conversations = await fetchConversations({
      supabase,
      userId: effectiveUserId,
      role: "business",
    });

    let initialThread = null;
    if (includeInitialThread && conversations.length) {
      let selectedConversation =
        (selectedConversationId
          ? conversations.find(
              (conversation) => conversation.id === selectedConversationId
            )
          : null) || conversations[0];

      if (
        selectedConversationId &&
        selectedConversation?.id !== selectedConversationId
      ) {
        const selectedById = await fetchConversationById({
          supabase,
          conversationId: selectedConversationId,
        });
        if (selectedById?.business_id === effectiveUserId) {
          selectedConversation = selectedById;
        }
      }

      if (selectedConversation?.business_id === effectiveUserId) {
        try {
          const [messagePage, orderContext] = await Promise.all([
            fetchMessagePage({
              supabase,
              conversationId: selectedConversation.id,
              limit: initialThreadLimit,
              includeSystemOrderUpdates: false,
            }),
            fetchConversationOrderContext({
              supabase,
              conversationId: selectedConversation.id,
            }),
          ]);

          const latestMessage =
            messagePage.messages[messagePage.messages.length - 1] || null;
          if (latestMessage) {
            selectedConversation = {
              ...selectedConversation,
              last_message_at:
                latestMessage.created_at || selectedConversation.last_message_at,
              last_message_preview:
                latestMessage.body || selectedConversation.last_message_preview || "",
            };
          } else {
            selectedConversation = {
              ...selectedConversation,
              last_message_preview: "Order conversation",
            };
          }

          initialThread = {
            conversationId: selectedConversation.id,
            conversation: selectedConversation,
            orderContext,
            messages: messagePage.messages,
            hasMore: messagePage.hasMore,
          };

          if (
            selectedConversationId &&
            selectedConversation.id === selectedConversationId &&
            !conversations.some(
              (conversation) => conversation.id === selectedConversation.id
            )
          ) {
            conversations.unshift(selectedConversation);
          }
        } catch (threadError) {
          initialThread = {
            conversationId: selectedConversation.id,
            conversation: selectedConversation,
            orderContext: null,
            messages: [],
            hasMore: false,
            error:
              threadError?.message || "Failed to load the selected conversation",
          };
        }
      }
    }

    const response = NextResponse.json(
      { conversations, initialThread },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Failed to load conversations" },
      { status: 500 }
    );
  }
}

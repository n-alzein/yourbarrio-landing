import BusinessConversationClient from "@/components/messages/BusinessConversationClient";
import { getBusinessDataClientForRequest } from "@/lib/business/getBusinessDataClientForRequest";
import {
  fetchConversationOrderContext,
  fetchConversationWithMessages,
} from "@/lib/messages";
import { createServerTiming, logServerTiming, perfTimingEnabled } from "@/lib/serverTiming";

export default async function BusinessConversationPage({ params }) {
  const timing = createServerTiming("biz_thread_page_");
  const totalStart = timing.start();
  const resolvedParams = await params;
  const conversationId = resolvedParams?.conversationId || "";

  let initialConversation = null;
  let initialMessages = [];
  let initialHasMore = false;
  let initialOrderContext = null;
  let initialError = null;
  let initialUserId = null;

  const access = await getBusinessDataClientForRequest({
    includeEffectiveProfile: false,
    ensureVendorMembership: false,
    timingLabel: "business-thread-access",
  });

  if (!access.ok || !conversationId) {
    initialError = "We couldn't load this conversation. Try again soon.";
  } else {
    initialUserId = access.effectiveUserId;

    try {
      const thread = await fetchConversationWithMessages({
        supabase: access.client,
        conversationId,
        profileRole: "customer",
        onTiming: async (payload) => {
          if (!(await perfTimingEnabled())) return;
          await logServerTiming("business-thread-data", payload);
        },
      });

      if (!thread.conversation || thread.conversation.business_id !== access.effectiveUserId) {
        initialError = "We couldn't load this conversation. Try again soon.";
      } else {
        initialConversation = thread.conversation;
        initialMessages = thread.messages;
        initialHasMore = Boolean(thread.hasMore);
        initialOrderContext = await fetchConversationOrderContext({
          supabase: access.client,
          conversationId,
        });
      }
    } catch (err) {
      console.error("Failed to load business conversation on the server", err);
      initialError = "We couldn't load this conversation. Try again soon.";
    }
  }

  if (await perfTimingEnabled()) {
    const totalRenderMs = timing.end("total", totalStart);
    await logServerTiming("business-thread-page", {
      conversationId,
      messageCount: initialMessages.length,
      hasConversation: Boolean(initialConversation),
      totalRenderMs: Math.round(totalRenderMs),
      timing: timing.header(),
    });
  }

  return (
    <BusinessConversationClient
      conversationId={conversationId}
      initialConversation={initialConversation}
      initialMessages={initialMessages}
      initialHasMore={initialHasMore}
      initialOrderContext={initialOrderContext}
      initialError={initialError}
      initialUserId={initialUserId}
    />
  );
}

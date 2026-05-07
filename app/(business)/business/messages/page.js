import BusinessMessagesInboxClient from "@/components/messages/BusinessMessagesInboxClient";
import { getBusinessDataClientForRequest } from "@/lib/business/getBusinessDataClientForRequest";
import {
  fetchConversationOrderContext,
  fetchConversations,
  fetchMessagePage,
} from "@/lib/messages";
import { createServerTiming, logServerTiming, perfTimingEnabled } from "@/lib/serverTiming";

export default async function BusinessMessagesPage({ searchParams }) {
  const timing = createServerTiming("biz_msg_page_");
  const totalStart = timing.start();
  const resolvedSearchParams = await searchParams;
  const requestedThreadId =
    typeof resolvedSearchParams?.thread === "string"
      ? resolvedSearchParams.thread
      : "";
  let initialConversations = [];
  let initialThread = null;
  let initialError = null;
  let initialUserId = null;

  const access = await getBusinessDataClientForRequest({
    includeEffectiveProfile: false,
    ensureVendorMembership: false,
    timingLabel: "business-messages-access",
  });

  if (!access.ok) {
    initialError = "We couldn't load your messages. Please try again.";
  } else {
    initialUserId = access.effectiveUserId;
    try {
      initialConversations = await fetchConversations({
        supabase: access.client,
        userId: access.effectiveUserId,
        role: "business",
        onTiming: async (payload) => {
          if (!(await perfTimingEnabled())) return;
          await logServerTiming("business-messages-inbox-data", payload);
        },
      });
      const selectedConversation =
        initialConversations.find(
          (conversation) => conversation.id === requestedThreadId
        ) ||
        initialConversations[0] ||
        null;
      if (selectedConversation?.id) {
        const [messagePage, orderContext] = await Promise.all([
          fetchMessagePage({
            supabase: access.client,
            conversationId: selectedConversation.id,
            includeSystemOrderUpdates: false,
          }),
          fetchConversationOrderContext({
            supabase: access.client,
            conversationId: selectedConversation.id,
          }),
        ]);
        initialThread = {
          conversationId: selectedConversation.id,
          conversation: selectedConversation,
          messages: messagePage.messages,
          hasMore: Boolean(messagePage.hasMore),
          orderContext,
        };
      }
    } catch (err) {
      console.error("Failed to load business conversations on the server", err);
      initialError = "We couldn't load your messages. Please try again.";
    }
  }

  const intro =
    "Stay connected with customers, confirm orders, and follow up on leads from your inbox.";

  if (await perfTimingEnabled()) {
    const totalRenderMs = timing.end("total", totalStart);
    await logServerTiming("business-messages-page", {
      conversationCount: initialConversations.length,
      totalRenderMs: Math.round(totalRenderMs),
      timing: timing.header(),
    });
  }

  return (
    <section className="w-full min-h-screen bg-[#f6f7fb] px-4 pb-10 pt-0 text-slate-950 sm:px-5 md:px-6 md:pb-14 lg:px-8">
      <div className="w-full">
        <div className="mx-auto max-w-7xl">
          <BusinessMessagesInboxClient
            initialConversations={initialConversations}
            initialThread={initialThread}
            initialError={initialError}
            initialUserId={initialUserId}
            intro={intro}
          />
        </div>
      </div>
    </section>
  );
}

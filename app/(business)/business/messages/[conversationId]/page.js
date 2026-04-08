import BusinessConversationClient from "@/components/messages/BusinessConversationClient";
import { getBusinessDataClientForRequest } from "@/lib/business/getBusinessDataClientForRequest";
import { fetchConversationWithMessages } from "@/lib/messages";
import { createServerTiming, logServerTiming, perfTimingEnabled } from "@/lib/serverTiming";

export default async function BusinessConversationPage({ params }) {
  const timing = createServerTiming("biz_thread_page_");
  const totalStart = timing.start();
  const resolvedParams = await params;
  const conversationId = resolvedParams?.conversationId || "";

  let initialConversation = null;
  let initialMessages = [];
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
    <section className="relative w-full min-h-screen pt-6 md:pt-8 text-white overflow-hidden -mt-8 md:-mt-12 pb-20 md:pb-24">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0720] via-[#0a0816] to-black" />
        <div className="absolute -top-32 -left-20 h-[360px] w-[360px] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute top-10 right-10 h-[300px] w-[300px] rounded-full bg-pink-500/15 blur-[120px]" />
      </div>

      <div className="w-full px-5 sm:px-6 md:px-8 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <BusinessConversationClient
            conversationId={conversationId}
            initialConversation={initialConversation}
            initialMessages={initialMessages}
            initialError={initialError}
            initialUserId={initialUserId}
          />
        </div>
      </div>
    </section>
  );
}

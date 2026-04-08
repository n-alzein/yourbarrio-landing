import BusinessMessagesInboxClient from "@/components/messages/BusinessMessagesInboxClient";
import { getBusinessDataClientForRequest } from "@/lib/business/getBusinessDataClientForRequest";
import { fetchConversations } from "@/lib/messages";
import { createServerTiming, logServerTiming, perfTimingEnabled } from "@/lib/serverTiming";

export default async function BusinessMessagesPage() {
  const timing = createServerTiming("biz_msg_page_");
  const totalStart = timing.start();
  let initialConversations = [];
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
    <section className="relative w-full min-h-screen pt-6 md:pt-8 text-white overflow-hidden -mt-8 md:-mt-12 pb-12 md:pb-16">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0720] via-[#0a0816] to-black" />
        <div className="absolute -top-32 -left-20 h-[360px] w-[360px] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute top-10 right-10 h-[300px] w-[300px] rounded-full bg-pink-500/15 blur-[120px]" />
      </div>

      <div className="w-full px-5 sm:px-6 md:px-8 lg:px-12">
        <div className="max-w-5xl mx-auto">
          <BusinessMessagesInboxClient
            initialConversations={initialConversations}
            initialError={initialError}
            initialUserId={initialUserId}
            intro={intro}
          />
        </div>
      </div>
    </section>
  );
}

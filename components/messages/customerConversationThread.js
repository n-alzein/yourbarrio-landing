import { getAuthedContext } from "@/lib/auth/getAuthedContext";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { filterRealConversationMessages, sendMessage } from "@/lib/messages";
import { retry } from "@/lib/retry";

export const CUSTOMER_THREAD_PAGE_SIZE = 40;

export async function fetchCustomerMessagePage({
  conversationId,
  before,
  beforeId,
  limit = CUSTOMER_THREAD_PAGE_SIZE,
  signal,
}) {
  const params = new URLSearchParams({
    conversationId,
    limit: String(limit),
  });
  if (before) params.set("before", before);
  if (beforeId) params.set("beforeId", beforeId);

  const response = await retry(
    () =>
      fetchWithTimeout(`/api/customer/messages?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        timeoutMs: 12000,
        signal,
      }),
    { retries: 1, delayMs: 600 }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to load messages");
  }

  const payload = await response.json();
  return {
    messages: filterRealConversationMessages(payload?.messages),
    hasMore: Boolean(payload?.hasMore),
  };
}

export async function fetchCustomerConversationThread({
  conversationId,
  signal,
}) {
  const [convoResponse, messagePage] = await Promise.all([
    fetchWithTimeout(
      `/api/customer/conversations?conversationId=${encodeURIComponent(
        conversationId
      )}`,
      {
        method: "GET",
        credentials: "include",
        timeoutMs: 12000,
        signal,
      }
    ),
    fetchCustomerMessagePage({ conversationId, signal }),
  ]);

  if (!convoResponse.ok) {
    const message = await convoResponse.text();
    throw new Error(message || "Failed to load conversation");
  }
  const convoPayload = await convoResponse.json();

  return {
    conversation: convoPayload?.conversation ?? null,
    orderContext: convoPayload?.orderContext ?? null,
    messages: messagePage.messages,
    hasMore: messagePage.hasMore,
  };
}

export async function sendCustomerConversationReply({
  conversation,
  body,
}) {
  const { client, session, userId } = await getAuthedContext("sendMessage");
  const recipientId =
    conversation.customer_id === userId
      ? conversation.business_id
      : conversation.customer_id;

  if (!recipientId || recipientId === userId) {
    throw new Error("Message recipient unavailable");
  }

  return sendMessage({
    supabase: client,
    conversationId: conversation.id,
    recipientId,
    body,
    session,
  });
}

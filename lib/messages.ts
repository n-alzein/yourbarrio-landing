import { getBrowserSupabaseClient } from "@/lib/supabaseClient";

export const MESSAGE_PAGE_SIZE = 50;

export function getDisplayName(profile: {
  business_name?: string | null;
  full_name?: string | null;
} | null) {
  return profile?.business_name || profile?.full_name || "Unknown";
}

export function getAvatarUrl(profile: {
  profile_photo_url?: string | null;
} | null) {
  return profile?.profile_photo_url || "/business-placeholder.png";
}

export function getUnreadCount(
  conversation: {
    customer_unread_count?: number | null;
    business_unread_count?: number | null;
  },
  role: "customer" | "business"
) {
  return role === "business"
    ? Number(conversation?.business_unread_count || 0)
    : Number(conversation?.customer_unread_count || 0);
}

export async function fetchConversations({
  supabase,
  userId,
  role,
}: {
  supabase?: any;
  userId: string;
  role: "customer" | "business";
}) {
  const client = supabase ?? getBrowserSupabaseClient();
  if (!client) return [];

  const idField = role === "business" ? "business_id" : "customer_id";
  const { data, error } = await client
    .from("conversations")
    .select(
      [
        "id",
        "customer_id",
        "business_id",
        "last_message_at",
        "last_message_preview",
        "customer_unread_count",
        "business_unread_count",
        "customer:customer_id(id, full_name, business_name, profile_photo_url)",
        "business:business_id(id, full_name, business_name, profile_photo_url)",
      ].join(",")
    )
    .eq(idField, userId)
    .order("last_message_at", { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchConversationById({
  supabase,
  conversationId,
}: {
  supabase?: any;
  conversationId: string;
}) {
  const client = supabase ?? getBrowserSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from("conversations")
    .select(
      [
        "id",
        "customer_id",
        "business_id",
        "last_message_at",
        "last_message_preview",
        "customer_unread_count",
        "business_unread_count",
        "customer:customer_id(id, full_name, business_name, profile_photo_url)",
        "business:business_id(id, full_name, business_name, profile_photo_url)",
      ].join(",")
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function fetchMessages({
  supabase,
  conversationId,
  limit = MESSAGE_PAGE_SIZE,
  before,
}: {
  supabase?: any;
  conversationId: string;
  limit?: number;
  before?: string | null;
}) {
  const client = supabase ?? getBrowserSupabaseClient();
  if (!client) return [];

  let query = client
    .from("messages")
    .select("id, conversation_id, sender_id, recipient_id, body, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.reverse();
}

export async function sendMessage({
  supabase,
  conversationId,
  senderId,
  recipientId,
  body,
}: {
  supabase?: any;
  conversationId: string;
  senderId: string;
  recipientId: string;
  body: string;
}) {
  const client = supabase ?? getBrowserSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      recipient_id: recipientId,
      body,
    })
    .select("id, conversation_id, sender_id, recipient_id, body, created_at, read_at")
    .single();

  if (error) throw error;
  return data || null;
}

export async function getOrCreateConversation({
  supabase,
  customerId,
  businessId,
}: {
  supabase?: any;
  customerId: string;
  businessId: string;
}) {
  const client = supabase ?? getBrowserSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.rpc("get_or_create_conversation", {
    customer_id: customerId,
    business_id: businessId,
  });

  if (!error) return data || null;

  const message = (error?.message || "").toLowerCase();
  const missingRpc =
    error?.code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("function public.get_or_create_conversation");

  if (!missingRpc) throw error;

  const { data: upserted, error: upsertError } = await client
    .from("conversations")
    .upsert(
      { customer_id: customerId, business_id: businessId },
      { onConflict: "customer_id,business_id" }
    )
    .select("id")
    .single();

  if (upsertError) throw upsertError;
  return upserted?.id || null;
}

export async function markConversationRead({
  supabase,
  conversationId,
}: {
  supabase?: any;
  conversationId: string;
}) {
  const client = supabase ?? getBrowserSupabaseClient();
  if (!client) return null;

  const { error } = await client.rpc("mark_conversation_read", {
    conversation_id: conversationId,
  });

  if (error) throw error;
  return true;
}

export async function fetchUnreadTotal({
  supabase,
  userId,
  role,
}: {
  supabase?: any;
  userId: string;
  role: "customer" | "business";
}) {
  const client = supabase ?? getBrowserSupabaseClient();
  if (!client) return 0;

  const field = role === "business" ? "business_id" : "customer_id";
  const { data, error } = await client
    .from("conversations")
    .select("customer_unread_count, business_unread_count")
    .eq(field, userId);

  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.reduce((sum, row) => sum + getUnreadCount(row, role), 0);
}

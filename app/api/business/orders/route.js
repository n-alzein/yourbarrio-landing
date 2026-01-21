import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { safeGetUser } from "@/lib/auth/safeGetUser";
import { getLowStockThreshold } from "@/lib/inventory";

const STATUS_TABS = {
  new: ["requested"],
  progress: ["confirmed", "ready", "out_for_delivery"],
  completed: ["fulfilled"],
  cancelled: ["cancelled"],
};

const STATUS_LABELS = {
  requested: "Requested",
  confirmed: "Confirmed",
  ready: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  fulfilled: "Fulfilled",
  completed: "Completed",
  cancelled: "Cancelled",
};

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function aggregateOrderItems(items) {
  const totals = new Map();
  if (!Array.isArray(items)) return totals;
  items.forEach((item) => {
    if (!item?.listing_id) return;
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    totals.set(item.listing_id, (totals.get(item.listing_id) || 0) + quantity);
  });
  return totals;
}

function resolveNextInventoryStatus(currentStatus, nextQuantity, thresholdValue) {
  if (currentStatus === "always_available" || currentStatus === "seasonal") {
    return currentStatus;
  }
  if (nextQuantity <= 0) return "out_of_stock";
  const threshold = getLowStockThreshold({ low_stock_threshold: thresholdValue });
  if (nextQuantity <= threshold) return "low_stock";
  return "in_stock";
}

async function decrementInventoryForOrder({
  client,
  businessId,
  timestamp,
  items,
}) {
  const totals = aggregateOrderItems(items);
  if (totals.size === 0) return;

  const listingIds = Array.from(totals.keys());
  const { data: listings, error } = await client
    .from("listings")
    .select("id, inventory_quantity, inventory_status, low_stock_threshold")
    .in("id", listingIds)
    .eq("business_id", businessId);

  if (error) throw error;

  for (const listing of listings || []) {
    const currentQuantity = Number(listing.inventory_quantity);
    if (!Number.isFinite(currentQuantity)) continue;
    const orderedQuantity = totals.get(listing.id) || 0;
    if (orderedQuantity <= 0) continue;

    const nextQuantity = Math.max(0, currentQuantity - orderedQuantity);
    const nextStatus = resolveNextInventoryStatus(
      listing.inventory_status,
      nextQuantity,
      listing.low_stock_threshold
    );

    const { error: updateError } = await client
      .from("listings")
      .update({
        inventory_quantity: nextQuantity,
        inventory_status: nextStatus,
        inventory_last_updated_at: timestamp,
      })
      .eq("id", listing.id)
      .eq("business_id", businessId);

    if (updateError) throw updateError;
  }
}

async function getOrCreateConversationId(client, customerId, businessId) {
  if (!client || !customerId || !businessId) return null;

  const { data, error } = await client.rpc("get_or_create_conversation", {
    customer_id: customerId,
    business_id: businessId,
  });

  if (!error && data) return data;

  const message = (error?.message || "").toLowerCase();
  const missingRpc =
    error?.code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("function public.get_or_create_conversation");

  if (!missingRpc) throw error;

  const { data: existing, error: existingError } = await client
    .from("conversations")
    .select("id")
    .eq("customer_id", customerId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id;

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

async function getProfile(supabase, userId) {
  const { data, error } = await supabase
    .from("users")
    .select("id,role,business_name,full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function ensureVendorMember(supabase, vendorId, userId) {
  if (!vendorId || !userId) return;
  const { data: existing } = await supabase
    .from("vendor_members")
    .select("id")
    .eq("vendor_id", vendorId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.id) return;

  const { error } = await supabase.from("vendor_members").insert({
    vendor_id: vendorId,
    user_id: userId,
    role: "owner",
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}

export async function GET(request) {
  const supabase = await createSupabaseServerClient();
  const { user, error: userError } = await safeGetUser(supabase);

  if (userError || !user) {
    return jsonError("Unauthorized", 401);
  }

  let profile;
  try {
    profile = await getProfile(supabase, user.id);
  } catch (err) {
    return jsonError(err?.message || "Failed to load profile", 500);
  }

  if (profile?.role !== "business") {
    return jsonError("Forbidden", 403);
  }

  try {
    await ensureVendorMember(supabase, profile.id, user.id);
  } catch (err) {
    return jsonError(err?.message || "Failed to verify membership", 500);
  }

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "new";
  const statusList = STATUS_TABS[tab] || STATUS_TABS.new;

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("vendor_id", profile.id)
    .in("status", statusList)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonError(error.message || "Failed to load orders", 500);
  }

  return NextResponse.json({ orders: data || [] }, { status: 200 });
}

export async function PATCH(request) {
  const supabase = await createSupabaseServerClient();
  const serviceClient = getSupabaseServerClient();
  const { user, error: userError } = await safeGetUser(supabase);

  if (userError || !user) {
    return jsonError("Unauthorized", 401);
  }

  let profile;
  try {
    profile = await getProfile(supabase, user.id);
  } catch (err) {
    return jsonError(err?.message || "Failed to load profile", 500);
  }

  if (profile?.role !== "business") {
    return jsonError("Forbidden", 403);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const orderId = body?.order_id;
  const nextStatus = body?.status;

  if (!orderId || !nextStatus) {
    return jsonError("Missing order_id or status", 400);
  }

  const { data: existingOrder, error: existingOrderError } = await supabase
    .from("orders")
    .select("id, status, vendor_id, confirmed_at, fulfilled_at, cancelled_at")
    .eq("id", orderId)
    .eq("vendor_id", profile.id)
    .maybeSingle();

  if (existingOrderError) {
    return jsonError(existingOrderError.message || "Failed to load order", 500);
  }

  if (!existingOrder) {
    return jsonError("Order not found", 404);
  }

  const allowed = [
    "confirmed",
    "ready",
    "out_for_delivery",
    "fulfilled",
    "cancelled",
  ];

  if (!allowed.includes(nextStatus)) {
    return jsonError("Invalid status", 400);
  }

  const shouldAdjustInventory =
    nextStatus === "confirmed" && existingOrder.status !== "confirmed";
  let orderItems = [];

  if (shouldAdjustInventory) {
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("listing_id, quantity")
      .eq("order_id", orderId);

    if (itemsError) {
      return jsonError(itemsError.message || "Failed to load order items", 500);
    }

    orderItems = items || [];
  }

  const timestamp = new Date().toISOString();
  const updates = {
    status: nextStatus,
    updated_at: timestamp,
  };

  if (nextStatus === "confirmed") updates.confirmed_at = timestamp;
  if (nextStatus === "fulfilled") updates.fulfilled_at = timestamp;
  if (nextStatus === "cancelled") updates.cancelled_at = timestamp;

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", orderId)
    .select(
      "id,order_number,user_id,status,updated_at,confirmed_at,fulfilled_at,cancelled_at"
    )
    .maybeSingle();

  if (error) {
    return jsonError(error.message || "Failed to update order", 500);
  }

  if (shouldAdjustInventory) {
    const inventoryClient = serviceClient ?? supabase;
    try {
      await decrementInventoryForOrder({
        client: inventoryClient,
        businessId: profile.id,
        timestamp,
        items: orderItems,
      });
    } catch (inventoryError) {
      await supabase
        .from("orders")
        .update({
          status: existingOrder.status,
          confirmed_at: existingOrder.confirmed_at,
          fulfilled_at: existingOrder.fulfilled_at,
          cancelled_at: existingOrder.cancelled_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("vendor_id", profile.id);

      return jsonError(
        inventoryError?.message || "Failed to update inventory",
        500
      );
    }
  }

  if (data?.user_id) {
    const statusLabel = STATUS_LABELS[data.status] || data.status;
    const notificationClient = serviceClient ?? supabase;
    const { error: notificationError } = await notificationClient
      .from("notifications")
      .insert({
        recipient_user_id: data.user_id,
        vendor_id: profile.id,
        order_id: data.id,
        type: "order_status",
        title: `Order ${data.order_number} update`,
        body: `Your order status is now ${statusLabel}.`,
      });
    if (notificationError) {
      return jsonError(
        notificationError.message || "Failed to send notification",
        500
      );
    }

    const conversationId = await getOrCreateConversationId(
      notificationClient,
      data.user_id,
      profile.id
    );
    if (!conversationId) {
      return jsonError("Failed to start conversation", 500);
    }

    const { error: messageError } = await notificationClient
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: profile.id,
        recipient_id: data.user_id,
        body: `Order ${data.order_number} update: Your order status is now ${statusLabel}.`,
      });
    if (messageError) {
      return jsonError(
        messageError.message || "Failed to send message",
        500
      );
    }
  }

  return NextResponse.json({ order: data }, { status: 200 });
}

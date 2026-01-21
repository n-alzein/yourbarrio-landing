import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { safeGetUser } from "@/lib/auth/safeGetUser";

const STATUS_TABS = {
  new: ["requested"],
  progress: ["confirmed", "ready", "out_for_delivery"],
  completed: ["fulfilled"],
  cancelled: ["cancelled"],
};

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
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
    .select("id,status,updated_at,confirmed_at,fulfilled_at,cancelled_at")
    .maybeSingle();

  if (error) {
    return jsonError(error.message || "Failed to update order", 500);
  }

  return NextResponse.json({ order: data }, { status: 200 });
}

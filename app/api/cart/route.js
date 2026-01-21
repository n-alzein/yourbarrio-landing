import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { safeGetUser } from "@/lib/auth/safeGetUser";
import { primaryPhotoUrl } from "@/lib/listingPhotos";

async function getActiveCart(supabase, userId) {
  const { data, error } = await supabase
    .from("carts")
    .select("*, cart_items(*)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { data: vendor } = await supabase
    .from("users")
    .select("id,business_name,full_name,profile_photo_url,city,address")
    .eq("id", data.vendor_id)
    .maybeSingle();

  return { cart: data, vendor: vendor || null };
}

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { user, error: userError } = await safeGetUser(supabase);

  if (userError || !user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const payload = await getActiveCart(supabase, user.id);
    return NextResponse.json(payload || { cart: null, vendor: null }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return jsonError(err?.message || "Failed to load cart", 500);
  }
}

export async function POST(request) {
  const supabase = await createSupabaseServerClient();
  const { user, error: userError } = await safeGetUser(supabase);

  if (userError || !user) {
    return jsonError("Unauthorized", 401);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const listingId = body?.listing_id;
  const quantity = Number(body?.quantity || 1);
  const clearExisting = Boolean(body?.clear_existing);

  if (!listingId) {
    return jsonError("Missing listing_id", 400);
  }
  if (!Number.isFinite(quantity) || quantity < 1) {
    return jsonError("Quantity must be at least 1", 400);
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id,business_id,title,price,photo_url")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError) {
    return jsonError(listingError.message || "Failed to load listing", 500);
  }
  if (!listing) {
    return jsonError("Listing not found", 404);
  }

  let activePayload;
  try {
    activePayload = await getActiveCart(supabase, user.id);
  } catch (err) {
    return jsonError(err?.message || "Failed to load cart", 500);
  }

  let activeCart = activePayload?.cart || null;

  if (activeCart && activeCart.vendor_id !== listing.business_id) {
    if (!clearExisting) {
      return jsonError("Cart vendor mismatch", 409, {
        code: "vendor_mismatch",
        cart_vendor_id: activeCart.vendor_id,
      });
    }

    await supabase
      .from("carts")
      .update({ status: "abandoned", updated_at: new Date().toISOString() })
      .eq("id", activeCart.id);

    activeCart = null;
  }

  if (!activeCart) {
    const { data: newCart, error: cartError } = await supabase
      .from("carts")
      .insert({
        user_id: user.id,
        vendor_id: listing.business_id,
        status: "active",
        fulfillment_type: null,
      })
      .select("*")
      .single();

    if (cartError) {
      return jsonError(cartError.message || "Failed to create cart", 500);
    }

    activeCart = newCart;
  }

  const { data: existingItem, error: existingError } = await supabase
    .from("cart_items")
    .select("id,quantity")
    .eq("cart_id", activeCart.id)
    .eq("listing_id", listing.id)
    .maybeSingle();

  if (existingError) {
    return jsonError(existingError.message || "Failed to check cart", 500);
  }

  const itemPayload = {
    cart_id: activeCart.id,
    vendor_id: listing.business_id,
    listing_id: listing.id,
    quantity: existingItem ? existingItem.quantity + quantity : quantity,
    title: listing.title,
    unit_price: listing.price,
    image_url: primaryPhotoUrl(listing.photo_url),
    updated_at: new Date().toISOString(),
  };

  if (existingItem) {
    const { error: updateError } = await supabase
      .from("cart_items")
      .update({ quantity: itemPayload.quantity, updated_at: itemPayload.updated_at })
      .eq("id", existingItem.id);

    if (updateError) {
      return jsonError(updateError.message || "Failed to update cart item", 500);
    }
  } else {
    const { error: insertError } = await supabase
      .from("cart_items")
      .insert(itemPayload);

    if (insertError) {
      return jsonError(insertError.message || "Failed to add cart item", 500);
    }
  }

  try {
    const payload = await getActiveCart(supabase, user.id);
    return NextResponse.json(payload || { cart: null, vendor: null }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return jsonError(err?.message || "Failed to load cart", 500);
  }
}

export async function PATCH(request) {
  const supabase = await createSupabaseServerClient();
  const { user, error: userError } = await safeGetUser(supabase);

  if (userError || !user) {
    return jsonError("Unauthorized", 401);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const itemId = body?.item_id || null;
  const quantity = body?.quantity != null ? Number(body.quantity) : null;
  const hasFulfillmentType = Object.prototype.hasOwnProperty.call(body, "fulfillment_type");
  const fulfillmentType = hasFulfillmentType ? body?.fulfillment_type ?? null : null;

  let activePayload;
  try {
    activePayload = await getActiveCart(supabase, user.id);
  } catch (err) {
    return jsonError(err?.message || "Failed to load cart", 500);
  }

  const activeCart = activePayload?.cart || null;
  if (!activeCart) {
    return jsonError("Cart not found", 404);
  }

  if (hasFulfillmentType && fulfillmentType !== activeCart.fulfillment_type) {
    const { error: updateError } = await supabase
      .from("carts")
      .update({
        fulfillment_type: fulfillmentType,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeCart.id);

    if (updateError) {
      return jsonError(updateError.message || "Failed to update cart", 500);
    }
  }

  if (itemId && quantity != null) {
    if (!Number.isFinite(quantity) || quantity < 0) {
      return jsonError("Invalid quantity", 400);
    }

    if (quantity === 0) {
      const { error: deleteError } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", itemId);

      if (deleteError) {
        return jsonError(deleteError.message || "Failed to remove item", 500);
      }
    } else {
      const { error: updateItemError } = await supabase
        .from("cart_items")
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq("id", itemId);

      if (updateItemError) {
        return jsonError(updateItemError.message || "Failed to update item", 500);
      }
    }
  }

  try {
    const payload = await getActiveCart(supabase, user.id);
    return NextResponse.json(payload || { cart: null, vendor: null }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return jsonError(err?.message || "Failed to load cart", 500);
  }
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const { user, error: userError } = await safeGetUser(supabase);

  if (userError || !user) {
    return jsonError("Unauthorized", 401);
  }

  let activePayload;
  try {
    activePayload = await getActiveCart(supabase, user.id);
  } catch (err) {
    return jsonError(err?.message || "Failed to load cart", 500);
  }

  const activeCart = activePayload?.cart || null;
  if (!activeCart) {
    return NextResponse.json({ cart: null, vendor: null }, { status: 200 });
  }

  await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", activeCart.id);

  const { error: updateError } = await supabase
    .from("carts")
    .update({ status: "abandoned", updated_at: new Date().toISOString() })
    .eq("id", activeCart.id);

  if (updateError) {
    return jsonError(updateError.message || "Failed to clear cart", 500);
  }

  return NextResponse.json({ cart: null, vendor: null }, { status: 200 });
}

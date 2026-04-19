import { NextResponse } from "next/server";
import {
  fetchPurchaseHistoryOrders,
  parsePurchaseHistoryPagination,
} from "@/lib/orders/purchaseHistory";
import { getSupportAwareClient } from "@/lib/support/supportAwareData";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  let clientBundle;

  try {
    clientBundle = await getSupportAwareClient({
      expectedRole: "customer",
      feature: "purchase-history",
    });
  } catch (error) {
    return jsonError(error?.message || "Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePurchaseHistoryPagination({
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
  });

  const result = await fetchPurchaseHistoryOrders({
    client: clientBundle.client,
    userId: clientBundle.effectiveUserId,
    page,
    limit,
  });

  if (result.error) {
    return jsonError(result.error.message || "Failed to load orders.", 500);
  }

  return NextResponse.json(
    {
      orders: result.orders,
      total_count: result.total_count,
      total_pages: result.total_pages,
    },
    { status: 200 }
  );
}

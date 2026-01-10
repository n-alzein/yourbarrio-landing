import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [businessRes, viewsRes, savesRes, msgRes, reviewsRes, latestRes] =
    await Promise.all([
      supabase.from("users").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("business_views")
        .select("id", { count: "exact", head: true })
        .eq("business_id", user.id),
      supabase
        .from("business_saves")
        .select("id", { count: "exact", head: true })
        .eq("business_id", user.id),
      supabase
        .from("business_messages")
        .select("id", { count: "exact", head: true })
        .eq("business_id", user.id),
      supabase
        .from("business_reviews")
        .select("rating")
        .eq("business_id", user.id),
      supabase
        .from("conversations")
        .select(
          [
            "id",
            "last_message_preview",
            "last_message_at",
            "customer:customer_id (full_name, business_name, profile_photo_url)",
          ].join(",")
        )
        .eq("business_id", user.id)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const ratings = reviewsRes.data?.map((row) => row.rating) ?? [];
  const stats = {
    views: viewsRes.count ?? 0,
    saves: savesRes.count ?? 0,
    messages: msgRes.count ?? 0,
    rating: ratings.length
      ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1)
      : "",
    reviewCount: ratings.length,
    _businessId: user.id,
  };

  const latest = latestRes.data
    ? {
        id: latestRes.data.id,
        preview: latestRes.data.last_message_preview || "",
        time: latestRes.data.last_message_at,
        customer: latestRes.data.customer ?? null,
      }
    : null;

  const response = NextResponse.json(
    {
      business: businessRes.data ?? null,
      stats,
      latestMessage: latest,
    },
    { status: 200 }
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}

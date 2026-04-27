import "server-only";

import { NextResponse } from "next/server";
import {
  AI_DESCRIPTION_BUSINESS_TIMEZONE,
  AI_DESCRIPTION_DAILY_LIMIT,
  AI_DESCRIPTION_SURFACES,
  getBusinessDayStartIsoDaysAgo,
  getBusinessDayWindow,
} from "@/lib/ai/descriptionUsage";
import { getBusinessDataClientForRequest } from "@/lib/business/getBusinessDataClientForRequest";

export async function GET() {
  const access = await getBusinessDataClientForRequest({
    includeEffectiveProfile: false,
    ensureVendorMembership: false,
    timingLabel: "ai-description-usage",
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const dayWindow = getBusinessDayWindow();
  const last30DaysStartIso = getBusinessDayStartIsoDaysAgo(29);

  const [todayResult, recentResult, last30Result] = await Promise.all([
    access.client
      .from("ai_description_usage")
      .select("id", { count: "exact", head: true })
      .eq("business_id", access.businessId)
      .gte("created_at", dayWindow.startIso)
      .lt("created_at", dayWindow.endIso),
    access.client
      .from("ai_description_usage")
      .select(
        "id, business_id, user_id, surface, target_id, action, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_cents, created_at"
      )
      .eq("business_id", access.businessId)
      .order("created_at", { ascending: false })
      .limit(20),
    access.client
      .from("ai_description_usage")
      .select("surface, created_at")
      .eq("business_id", access.businessId)
      .gte("created_at", last30DaysStartIso),
  ]);

  if (todayResult.error || recentResult.error || last30Result.error) {
    console.warn("[ai-description-usage] analytics_query_failed", {
      businessId: access.businessId,
      todayError: todayResult.error?.message || null,
      recentError: recentResult.error?.message || null,
      last30Error: last30Result.error?.message || null,
    });
    return NextResponse.json(
      { error: "Unable to load AI description usage right now." },
      { status: 500 }
    );
  }

  const bySurface = AI_DESCRIPTION_SURFACES.reduce((acc, surface) => {
    acc[surface] = 0;
    return acc;
  }, {});

  for (const row of last30Result.data || []) {
    const surface = String(row?.surface || "").trim();
    if (Object.prototype.hasOwnProperty.call(bySurface, surface)) {
      bySurface[surface] += 1;
    }
  }

  const todayCount = Number(todayResult.count || 0);

  return NextResponse.json({
    todayCount,
    timezone: AI_DESCRIPTION_BUSINESS_TIMEZONE,
    todayLimit: AI_DESCRIPTION_DAILY_LIMIT,
    remainingToday: Math.max(0, AI_DESCRIPTION_DAILY_LIMIT - todayCount),
    bySurface,
    recentUsage: recentResult.data || [],
  });
}

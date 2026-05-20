import { NextResponse } from "next/server";
import {
  getBusinessEntitlements,
  getBusinessRemainingUsage,
  getBusinessSubscription,
} from "@/lib/monetization/entitlements";
import { FEATURES } from "@/lib/monetization/features";
import { requireBusinessMonetizationReadAccess } from "@/lib/monetization/access";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getBusinessId(params: any) {
  const resolved = typeof params?.then === "function" ? await params : params;
  return String(resolved?.businessId || "").trim();
}

export async function GET(_request: Request, { params }: { params: any }) {
  const businessId = await getBusinessId(params);
  if (!businessId) return jsonError("Missing business id", 400);

  const access = await requireBusinessMonetizationReadAccess(businessId);
  if (!access.ok) return jsonError(access.error, access.status);
  const authorized = access as any;

  const [subscription, entitlements, photoUsage, descriptionUsage, featuredUsage] =
    await Promise.all([
      getBusinessSubscription(businessId, authorized.serviceClient),
      getBusinessEntitlements(businessId, authorized.serviceClient),
      getBusinessRemainingUsage(businessId, FEATURES.AI_PHOTO_ENHANCEMENT, new Date(), authorized.serviceClient),
      getBusinessRemainingUsage(businessId, FEATURES.AI_DESCRIPTION_GENERATION, new Date(), authorized.serviceClient),
      getBusinessRemainingUsage(businessId, FEATURES.FEATURED_PLACEMENT, new Date(), authorized.serviceClient),
    ]);

  return NextResponse.json(
    {
      business: authorized.business,
      subscription,
      entitlements,
      usage: {
        [FEATURES.AI_PHOTO_ENHANCEMENT]: photoUsage,
        [FEATURES.AI_DESCRIPTION_GENERATION]: descriptionUsage,
        [FEATURES.FEATURED_PLACEMENT]: featuredUsage,
      },
      betaMessage:
        "YourBarrio is currently waiving platform fees for founding local businesses during beta.",
    },
    { status: 200 }
  );
}

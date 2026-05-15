import { NextResponse } from "next/server";
import { getCurrentAccountContext } from "@/lib/auth/getCurrentAccountContext";
import {
  normalizeCustomerLegalAcceptanceSource,
  recordCustomerLegalAcceptances,
} from "@/lib/auth/userLegalAcceptances";

export const dynamic = "force-dynamic";

const ACCEPTANCE_ERROR =
  "You need to accept the Terms of Service and acknowledge the Privacy Policy before creating your account.";

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const accepted =
    body?.customer_terms_accepted === true ||
    (body?.terms_accepted === true && body?.privacy_acknowledged === true);

  if (!accepted) {
    return NextResponse.json({ error: ACCEPTANCE_ERROR }, { status: 400 });
  }

  const accountContext = await getCurrentAccountContext({
    request,
    source: "api/account/legal-acceptances",
  });

  if (!accountContext?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const source = normalizeCustomerLegalAcceptanceSource(body?.source);
  try {
    await recordCustomerLegalAcceptances({
      userId: accountContext.user.id,
      source,
      userAgent: request.headers.get("user-agent") || "",
    });
  } catch (error) {
    console.error("Failed to record customer legal acceptance", error);
    return NextResponse.json(
      { error: "Failed to record legal acceptance." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getCurrentAccountContext } from "@/lib/auth/getCurrentAccountContext";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const response = NextResponse.next();
  const accountContext = await getCurrentAccountContext({
    request,
    response,
    source: "api/me",
  });

  const jsonResponse = NextResponse.json(
    {
      user: accountContext.isAuthenticated ? accountContext.user : null,
      profile: accountContext.isAuthenticated ? accountContext.profile : null,
      accountContext: {
        role: accountContext.isAuthenticated ? accountContext.role : "guest",
        isRoleResolved: accountContext.isRoleResolved,
        businessRowExists: accountContext.businessRowExists,
        canPurchase: accountContext.canPurchase,
        isBusiness: accountContext.isBusiness,
        isAuthenticated: accountContext.isAuthenticated,
      },
    },
    { status: accountContext.isAuthenticated ? 200 : 401 }
  );
  jsonResponse.headers.set("Cache-Control", "no-store");
  return jsonResponse;
}

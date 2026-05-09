import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabaseServer";
import { discardTemporaryMediaAssets } from "@/lib/images/mediaAssets.server";
import { redactMediaErrorMessage } from "@/lib/images/redactMediaError";

function jsonError(message, status = 400, code = "DISCARD_FAILED") {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(request) {
  const response = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(request, response);
  if (!authClient) {
    return jsonError("Server is missing Supabase credentials.", 500, "SERVER_CONFIG");
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user?.id) {
    return jsonError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const body = await request.json().catch(() => ({}));
  const assetIds = Array.isArray(body?.assetIds)
    ? body.assetIds.map(String).filter(Boolean)
    : body?.assetId
    ? [String(body.assetId)]
    : [];
  const uploadSessionId = body?.upload_session_id || body?.uploadSessionId || null;

  try {
    const result = await discardTemporaryMediaAssets({
      ownerUserId: user.id,
      assetIds,
      uploadSessionId: uploadSessionId ? String(uploadSessionId) : null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[media.discard-temp] failed", {
      userId: user.id,
      count: assetIds.length,
      hasUploadSession: Boolean(uploadSessionId),
      message: redactMediaErrorMessage(err?.message || String(err)),
    });
    return jsonError("Failed to discard temporary upload.", 500, "DISCARD_FAILED");
  }
}

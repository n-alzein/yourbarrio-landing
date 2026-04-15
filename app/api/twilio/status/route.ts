import twilio from "twilio";
import { getAdminServiceRoleClient } from "@/lib/supabase/admin";
import { buildTwilioWebhookValidationUrl } from "@/lib/integrations/twilio";

export const runtime = "nodejs";

const TEXT_HEADERS = {
  "content-type": "text/plain; charset=utf-8",
};

function textResponse(body: string, status: number) {
  return new Response(body, {
    status,
    headers: TEXT_HEADERS,
  });
}

function logTwilioStatus(event: string, details: Record<string, unknown>) {
  const payload = {
    scope: "twilio_status_webhook",
    event,
    ...details,
  };

  if (event === "successful_update") {
    console.info(payload);
    return;
  }

  if (event === "server_misconfiguration") {
    console.error(payload);
    return;
  }

  console.warn(payload);
}

export async function POST(request: Request) {
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  if (!authToken) {
    logTwilioStatus("server_misconfiguration", {
      reason: "missing_twilio_auth_token",
    });
    return textResponse("server misconfiguration", 500);
  }

  const signature = String(request.headers.get("x-twilio-signature") || "").trim();
  if (!signature) {
    logTwilioStatus("invalid_signature", {
      reason: "missing_signature_header",
    });
    return textResponse("forbidden", 403);
  }

  const formData = await request.formData();
  const payload = Object.fromEntries(
    Array.from(formData.entries(), ([key, value]) => [key, String(value)])
  );
  const validationUrl = buildTwilioWebhookValidationUrl(request);
  const isValid = twilio.validateRequest(authToken, signature, validationUrl, payload);

  if (!isValid) {
    logTwilioStatus("invalid_signature", {
      reason: "signature_mismatch",
      validationUrl,
    });
    return textResponse("forbidden", 403);
  }

  const messageSid = String(payload.MessageSid || payload.SmsSid || "").trim();
  const messageStatus = String(payload.MessageStatus || payload.SmsStatus || "").trim();

  if (!messageSid || !messageStatus) {
    logTwilioStatus("malformed_payload", {
      messageSid: messageSid || null,
      messageStatus: messageStatus || null,
    });
    return textResponse("ok", 200);
  }

  const client = getAdminServiceRoleClient();
  const { data: existingRow, error: lookupError } = await client
    .from("order_notifications")
    .select("id")
    .eq("provider_message_id", messageSid)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message || "Failed to load Twilio notification row");
  }

  if (!existingRow?.id) {
    logTwilioStatus("notification_not_found", {
      messageSid,
      messageStatus,
    });
    return textResponse("ok", 200);
  }

  const { error: updateError } = await client
    .from("order_notifications")
    .update({
      provider: "twilio",
      provider_message_id: messageSid,
      provider_status: messageStatus,
      provider_error_code: String(payload.ErrorCode || "").trim() || null,
      provider_error_message: String(payload.ErrorMessage || "").trim() || null,
      last_provider_event_at: new Date().toISOString(),
    })
    .eq("id", existingRow.id);

  if (updateError) {
    throw new Error(updateError.message || "Failed to update Twilio notification row");
  }

  logTwilioStatus("successful_update", {
    notificationId: existingRow.id,
    messageSid,
    messageStatus,
  });

  return textResponse("ok", 200);
}

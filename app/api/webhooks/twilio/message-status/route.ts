import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateOrderNotificationFromTwilioCallback } from "@/lib/notifications/orders";
import {
  buildTwilioSignatureUrls,
  validateTwilioRequestSignature,
} from "@/lib/integrations/twilio";

const twilioPayloadSchema = z.object({
  MessageSid: z.string().trim().optional(),
  SmsSid: z.string().trim().optional(),
  MessageStatus: z.string().trim().optional(),
  ErrorCode: z.string().trim().optional(),
  ErrorMessage: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const payload = Object.fromEntries(
    Array.from(form.entries()).map(([key, value]) => [key, String(value)])
  );
  const parsed = twilioPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  const signature = String(request.headers.get("x-twilio-signature") || "").trim();
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 403 });
  }

  const isValid = validateTwilioRequestSignature({
    urls: buildTwilioSignatureUrls(request),
    signature,
    params: payload,
  });
  if (!isValid) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  await updateOrderNotificationFromTwilioCallback({
    payload,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

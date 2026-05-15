import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { buildConfirmStartUrl } from "@/lib/auth/confirmStart";
import { getSiteUrlFromRequest } from "@/lib/auth/getSiteUrl";
import { supabaseAdmin } from "@/lib/auth/supabaseAdmin";
import { sendResetPasswordEmail } from "@/lib/email/sendResetPasswordEmail";
import { getSupabaseRefFromUrl } from "@/lib/supabase/ref";

const requestSchema = z.object({
  email: z.string().trim().email().max(320),
});

function getRecoveryRedirectTo(siteUrl: string) {
  return `${siteUrl}/auth/confirm?next=/set-password`;
}

function getPasswordResetSiteUrl(request: NextRequest) {
  const configuredSiteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").trim();
  const siteUrl = configuredSiteUrl || getSiteUrlFromRequest(request);

  try {
    const url = new URL(siteUrl);
    if (
      process.env.NODE_ENV === "production" &&
      (url.hostname === "yourbarrio.com" || url.hostname === "www.yourbarrio.com")
    ) {
      return "https://www.yourbarrio.com";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return getSiteUrlFromRequest(request);
  }
}

function maskEmail(input: string) {
  const [localPart, domain = ""] = String(input || "").split("@");
  if (!localPart) return "***";
  const prefix = localPart.slice(0, 2);
  return `${prefix}***@${domain}`;
}

function fingerprint(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const email = parsed.data.email.toLowerCase();
  const siteUrl = getPasswordResetSiteUrl(request);
  const generationSupabaseUrl = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  const verificationSupabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  const genRef = getSupabaseRefFromUrl(generationSupabaseUrl);
  const verifyRef = getSupabaseRefFromUrl(verificationSupabaseUrl);
  if (genRef !== verifyRef) {
    console.error("[auth.reset] supabase_ref_mismatch", {
      gen_ref: genRef,
      verify_ref: verifyRef,
    });
    if (process.env.NODE_ENV !== "production") {
      throw new Error("Supabase project mismatch between generation and verification");
    }
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: getRecoveryRedirectTo(siteUrl) },
    });

    if (error) {
      console.warn("[auth.request-password-reset] generateLink failed", {
        email: maskEmail(email),
        error: error.message,
      });
      return NextResponse.json({ ok: true });
    }

    const tokenHash = data?.properties?.hashed_token;
    if (!tokenHash) {
      console.warn("[auth.request-password-reset] generateLink returned no hashed_token", {
        email: maskEmail(email),
      });
      return NextResponse.json({ ok: true });
    }
    console.info("[auth.request-password-reset] generated_token", {
      type: "recovery",
      supabase_ref_generation: genRef,
      token_hash_len: tokenHash.length,
      token_hash_fp: fingerprint(tokenHash),
    });

    const resetUrl = buildConfirmStartUrl(tokenHash, "recovery", "/set-password", siteUrl);

    if (process.env.NODE_ENV !== "production") {
      console.info("[auth.request-password-reset] sending_resend_template", {
        templateId: process.env.RESEND_RESET_PASSWORD_TEMPLATE_ID || "reset-your-password",
        resetUrlOrigin: new URL(resetUrl).origin,
      });
    }

    await sendResetPasswordEmail({
      to: email,
      resetUrl,
      productName: "YourBarrio",
      supportEmail: process.env.SUPPORT_EMAIL || "support@yourbarrio.com",
    });
  } catch (error: any) {
    console.error("[auth.request-password-reset] unexpected error", {
      email: maskEmail(email),
      error: error?.message || "unknown_error",
    });
  }

  return NextResponse.json({ ok: true });
}

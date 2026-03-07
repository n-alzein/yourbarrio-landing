import "server-only";

import { supabaseAdmin } from "@/lib/auth/supabaseAdmin";
import { resend } from "@/lib/email/resendClient";

function getInviteRedirectUrl(siteUrl: string) {
  return new URL("/auth/confirm?next=/business/onboarding", siteUrl).toString();
}

function normalizeVerifyType(input: string) {
  const normalized = String(input || "").trim().toLowerCase();
  if (!normalized || normalized === "magiclink") return "email";
  return normalized;
}

function buildTokenHashConfirmLink(siteUrl: string, tokenHash: string, type = "email") {
  const link = new URL("/auth/confirm", siteUrl);
  link.searchParams.set("next", "/business/onboarding");
  link.searchParams.set("token_hash", tokenHash);
  link.searchParams.set("type", normalizeVerifyType(type));
  return link.toString();
}

export async function sendAdminInvite(
  email: string,
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000"
): Promise<{ userId: string; inviteLink: string }> {
  if (process.env.NODE_ENV !== "production") {
    console.log("[invite-flow] PATH=A adminInvite.ts reached", { email });
  }

  const restoreTripwires: Array<() => void> = [];
  if (process.env.NODE_ENV !== "production") {
    const adminApi = supabaseAdmin.auth.admin as Record<string, any>;
    if (typeof adminApi.inviteUserByEmail === "function") {
      const originalInviteUserByEmail = adminApi.inviteUserByEmail;
      adminApi.inviteUserByEmail = (..._args: any[]) => {
        console.log("[invite-flow] PATH=B calling inviteUserByEmail");
        throw new Error(
          "Do not call inviteUserByEmail/signInWithOtp for business invites; use generateLink + Resend template."
        );
      };
      restoreTripwires.push(() => {
        adminApi.inviteUserByEmail = originalInviteUserByEmail;
      });
    }

    const authApi = supabaseAdmin.auth as Record<string, any>;
    if (typeof authApi.signInWithOtp === "function") {
      const originalSignInWithOtp = authApi.signInWithOtp;
      authApi.signInWithOtp = (..._args: any[]) => {
        console.log("[invite-flow] PATH=C calling signInWithOtp");
        throw new Error(
          "Do not call inviteUserByEmail/signInWithOtp for business invites; use generateLink + Resend template."
        );
      };
      restoreTripwires.push(() => {
        authApi.signInWithOtp = originalSignInWithOtp;
      });
    }
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: getInviteRedirectUrl(siteUrl),
      },
    });

    if (error) {
      throw new Error(error.message || "Failed to generate invite link");
    }

    const hashedToken = data?.properties?.hashed_token || "";
    const verificationType = String(data?.properties?.verification_type || "email");
    const magicLink = hashedToken
      ? buildTokenHashConfirmLink(siteUrl, hashedToken, verificationType)
      : "";
    const userId = data?.user?.id;

    if (!magicLink || !userId) {
      throw new Error("Invite link generation returned incomplete data");
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[business-invite] link generated", Boolean(magicLink));
    }

    const { error: resendError } = await resend.emails.send({
      from: "YourBarrio <no-reply@yourbarrio.com>",
      to: email,
      subject: "YourBarrio — Set up your business account",
      template: {
        id: "business-account-invitation",
        variables: {
          magicLink,
          supportEmail: "support@yourbarrio.com",
        },
      },
      tags: [{ name: "email_kind", value: "business_invite" }],
    });

    if (resendError) {
      console.error("Business invite email failed:", resendError);
      throw new Error(resendError.message || "Business invite email failed");
    }

    console.log("[email] business invite sent", {
      to: email,
      subject: "YourBarrio — Set up your business account",
      template: "business-account-invitation",
    });

    const inviteLink = magicLink;
    return { userId, inviteLink };
  } finally {
    restoreTripwires.forEach((restore) => restore());
  }
}

import { getCustomerProfileCompletion } from "@/lib/customer/profile-completion";

export type NoticeVariant =
  | "info"
  | "success"
  | "warning"
  | "critical"
  | "profile"
  | "verification";

export type NoticeAudience = "customer" | "business" | "all";

export type Notice = {
  id: string;
  variant: NoticeVariant;
  priority: number;
  audience: NoticeAudience;
  title?: string;
  message: string;
  mobileTitle?: string;
  mobileMessage?: string;
  mobileCtaLabel?: string;
  ctaLabel?: string;
  ctaHref?: string;
  dismissible?: boolean;
  sticky?: boolean;
};

type ResolveNoticesInput = {
  user?: { id?: string; email?: string; email_confirmed_at?: string | null } | null;
  profile?: Record<string, unknown> | null;
  role?: string | null;
  pathname?: string | null;
  extraNotices?: Notice[];
};

function isExcludedProfileCompletionRoute(pathname = "") {
  return (
    pathname === "/customer/settings" ||
    pathname.startsWith("/customer/settings/") ||
    pathname === "/checkout" ||
    pathname.startsWith("/checkout/")
  );
}

function normalizeRole(role?: string | null, profile?: Record<string, unknown> | null) {
  return String(role || profile?.role || "").trim().toLowerCase();
}

function getCustomerProfileNoticeCopy(missingFields: string[]) {
  const missing = new Set(missingFields);
  const missingFullName = missing.has("full_name");
  const missingPhone = missing.has("phone");
  const missingAddress = missing.has("address");

  if (missingFullName && missingPhone && missingAddress) {
    return {
      title: "Finish setting up your account",
      message: "Add your name, phone, and address for faster checkout and pickup coordination.",
      mobileTitle: "Finish your account",
      mobileMessage: "Add missing details for faster checkout.",
      mobileCtaLabel: "Add details",
      ctaLabel: "Add details",
    };
  }

  if (missingFullName && missingPhone) {
    return {
      title: "Finish setting up your account",
      message: "Add your name and phone for faster checkout and pickup coordination.",
      mobileTitle: "Finish your account",
      mobileMessage: "Add missing details for faster checkout.",
      mobileCtaLabel: "Add details",
      ctaLabel: "Add details",
    };
  }

  if (missingPhone && missingAddress) {
    return {
      title: "Finish setting up your account",
      message: "Add your phone and address for faster checkout and pickup coordination.",
      mobileTitle: "Finish your account",
      mobileMessage: "Add missing details for faster checkout.",
      mobileCtaLabel: "Add details",
      ctaLabel: "Add details",
    };
  }

  if (missingFullName && missingAddress) {
    return {
      title: "Finish setting up your account",
      message: "Add your name and address for faster checkout and better nearby recommendations.",
      mobileTitle: "Finish your account",
      mobileMessage: "Add missing details for faster checkout.",
      mobileCtaLabel: "Add details",
      ctaLabel: "Add details",
    };
  }

  if (missingFullName) {
    return {
      title: "Add your name",
      message: "Help local shops know who they're helping with orders and messages.",
      mobileTitle: "Add your name",
      mobileMessage: "Personalize your account.",
      mobileCtaLabel: "Add name",
      ctaLabel: "Save name",
    };
  }

  if (missingPhone) {
    return {
      title: "Add a phone number",
      message: "Help local shops coordinate pickup if needed.",
      mobileTitle: "Add a phone number",
      mobileMessage: "Help with pickup coordination.",
      mobileCtaLabel: "Add phone",
      ctaLabel: "Add phone",
    };
  }

  return {
    title: "Save your address",
    message: "Make checkout faster and improve nearby recommendations.",
    mobileTitle: "Save your address",
    mobileMessage: "Make checkout faster.",
    mobileCtaLabel: "Add address",
    ctaLabel: "Add address",
  };
}

export function resolveNotices({
  user = null,
  profile = null,
  role = null,
  pathname = "",
  extraNotices = [],
}: ResolveNoticesInput = {}): Notice | null {
  const notices: Notice[] = [...extraNotices];
  const resolvedRole = normalizeRole(role, profile);

  if (user?.id && resolvedRole === "customer" && !isExcludedProfileCompletionRoute(pathname || "")) {
    const completion = getCustomerProfileCompletion(profile);
    if (completion.missingFields.length > 0) {
      const copy = getCustomerProfileNoticeCopy(completion.missingFields);
      notices.push({
        id: `customer-profile-completion:${user.id}`,
        variant: "profile",
        priority: 50,
        audience: "customer",
        title: copy.title,
        message: copy.message,
        mobileTitle: copy.mobileTitle,
        mobileMessage: copy.mobileMessage,
        mobileCtaLabel: copy.mobileCtaLabel,
        ctaLabel: copy.ctaLabel,
        ctaHref: "/customer/settings?complete=profile",
        dismissible: true,
        sticky: false,
      });
    }
  }

  if (notices.length === 0) return null;
  return [...notices].sort((a, b) => b.priority - a.priority)[0] || null;
}

export function getNoticeDismissalKey(noticeId: string) {
  return `yb_notice_dismissed:${noticeId}`;
}

export function isNoticeDismissedForSession(noticeId: string) {
  if (typeof window === "undefined" || !noticeId) return false;
  try {
    return window.sessionStorage.getItem(getNoticeDismissalKey(noticeId)) === "1";
  } catch {
    return false;
  }
}

export function dismissNoticeForSession(noticeId: string) {
  if (typeof window === "undefined" || !noticeId) return;
  try {
    window.sessionStorage.setItem(getNoticeDismissalKey(noticeId), "1");
  } catch {
    // Session storage is best effort only.
  }
}

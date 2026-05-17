export type BusinessProfileShareResult = "shared" | "copied" | "cancelled" | "failed";

type ShareNavigator = Navigator & {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

const DEFAULT_PUBLIC_ORIGIN = "https://yourbarrio.com";

function normalizeOrigin(value: string | undefined | null) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).origin;
  } catch {
    return "";
  }
}

function isLocalOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function getBusinessProfileShareUrl(publicPath: string | undefined | null) {
  const path = String(publicPath || "").trim() || "/";
  const currentOrigin =
    typeof window !== "undefined" ? normalizeOrigin(window.location.origin) : "";
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const origin =
    configuredOrigin ||
    (currentOrigin && (process.env.NODE_ENV !== "production" || !isLocalOrigin(currentOrigin))
      ? currentOrigin
      : DEFAULT_PUBLIC_ORIGIN);

  return new URL(path, origin).toString();
}

export function getBusinessProfileShareText(businessName: string) {
  const name = String(businessName || "").trim() || "this local business";
  return `Check out ${name} on YourBarrio.`;
}

export function isNativeShareCancellation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { name?: unknown; message?: unknown };
  const name = String(maybeError.name || "");
  const message = String(maybeError.message || "").toLowerCase();
  return (
    name === "AbortError" ||
    (name === "NotAllowedError" && message.includes("abort")) ||
    message.includes("cancel")
  );
}

export async function shareBusinessProfile({
  businessName,
  publicPath,
  navigatorRef = typeof navigator !== "undefined" ? navigator : undefined,
}: {
  businessName: string;
  publicPath: string | undefined | null;
  navigatorRef?: ShareNavigator;
}): Promise<BusinessProfileShareResult> {
  const url = getBusinessProfileShareUrl(publicPath);
  const shareData: ShareData = {
    title: businessName || "YourBarrio business profile",
    text: getBusinessProfileShareText(businessName),
    url,
  };

  if (navigatorRef?.share) {
    try {
      if (!navigatorRef.canShare || navigatorRef.canShare(shareData)) {
        await navigatorRef.share(shareData);
        return "shared";
      }
    } catch (error) {
      if (isNativeShareCancellation(error)) {
        return "cancelled";
      }
    }
  }

  if (navigatorRef?.clipboard?.writeText) {
    try {
      await navigatorRef.clipboard.writeText(url);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}

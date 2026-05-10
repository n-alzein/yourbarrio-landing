import { normalizeBusinessTypeSlug } from "@/lib/placeholders/businessPlaceholders";
import { resolveMediaAssetUrl } from "@/lib/images/resolveMediaAssetUrl";

export type BusinessImageInput = {
  business_name?: string | null;
  name?: string | null;
  full_name?: string | null;
  business_type?: string | null;
  businessTypeSlug?: string | null;
  businessTypeName?: string | null;
  category?: string | null;
  categoryLabel?: string | null;
  avatar_url?: string | null;
  logo_url?: string | null;
  profile_photo_url?: string | null;
  cover_photo_url?: string | null;
  cover_media_asset_id?: string | null;
  bucket?: string | null;
  purpose?: string | null;
  avatar_128_path?: string | null;
  avatar_256_path?: string | null;
  cover_mobile_path?: string | null;
  cover_desktop_path?: string | null;
  business_avatar_media_asset?: Record<string, unknown> | null;
  business_cover_media_asset?: Record<string, unknown> | null;
  media_assets?: Array<Record<string, unknown>> | null;
};

export type BusinessCategoryAccent = {
  slug: string;
  label: string;
  bg: string;
  bgSoft: string;
  fg: string;
  ring: string;
  pattern: string;
};

export type BusinessAvatarImage =
  | { kind: "image"; src: string }
  | {
      kind: "placeholder";
      initials: string;
      accent: BusinessCategoryAccent;
      label: string;
    };

const ONBOARDING_DEMO_BASE = "/placeholders/business/types";
const DEFAULT_ONBOARDING_DEMO_IMAGE = `${ONBOARDING_DEMO_BASE}/boutique.png`;
const ONBOARDING_DEMO_SLUGS = new Set([
  "boutique",
  "beauty-wellness",
  "bookstore",
  "automotive",
  "arts-crafts",
  "fitness",
  "tech-shop",
  "kids-family",
  "jewelry",
  "pet-shop",
  "florist-plants",
  "handmade-artisan",
  "grocery-specialty-foods",
  "home-services",
  "food-drink",
  "furniture-decor",
  "other",
  "home-goods",
  "professional-services",
  "specialty-retail",
  "gift-shop",
  "thrift-vintage",
  "travel-hospitality",
]);

const DEMO_PLACEHOLDER_PATH_RE = /\/placeholders\/business\/types\/[^?#]+\.(?:png|jpe?g|webp|avif)(?:[?#].*)?$/i;
const LEGACY_PLACEHOLDER_PATHS = new Set([
  "/business-placeholder.png",
  "/business-placeholder2.png",
  "/business-placeholder2-off.png",
  "/business-placeholder2-off2.png",
]);

const CATEGORY_ACCENTS: Record<string, Omit<BusinessCategoryAccent, "slug">> = {
  boutique: {
    label: "Boutique",
    bg: "#f7eef2",
    bgSoft: "#fff8f9",
    fg: "#7a3152",
    ring: "#ead3dd",
    pattern: "rgba(122,49,82,0.12)",
  },
  "tech-shop": {
    label: "Tech",
    bg: "#edf3ff",
    bgSoft: "#f8fbff",
    fg: "#3158a8",
    ring: "#d4e0fb",
    pattern: "rgba(49,88,168,0.13)",
  },
  "florist-plants": {
    label: "Plants",
    bg: "#edf8ef",
    bgSoft: "#fbfffb",
    fg: "#31704a",
    ring: "#d4ecd9",
    pattern: "rgba(49,112,74,0.13)",
  },
  bookstore: {
    label: "Books",
    bg: "#f2edf5",
    bgSoft: "#fffaf4",
    fg: "#5f3a67",
    ring: "#dfd2e5",
    pattern: "rgba(95,58,103,0.12)",
  },
  "beauty-wellness": {
    label: "Wellness",
    bg: "#f9edf5",
    bgSoft: "#fff8fc",
    fg: "#8a3f75",
    ring: "#ecd4e3",
    pattern: "rgba(138,63,117,0.12)",
  },
  "arts-crafts": {
    label: "Craft",
    bg: "#f8f0e7",
    bgSoft: "#fffaf4",
    fg: "#8a4e2c",
    ring: "#ead9c8",
    pattern: "rgba(138,78,44,0.12)",
  },
  "food-drink": {
    label: "Food",
    bg: "#f6efe5",
    bgSoft: "#fffaf3",
    fg: "#7b5427",
    ring: "#e8d8c0",
    pattern: "rgba(123,84,39,0.12)",
  },
  "home-services": {
    label: "Service",
    bg: "#edf5f4",
    bgSoft: "#f8fdfc",
    fg: "#2e6f6c",
    ring: "#d2e7e5",
    pattern: "rgba(46,111,108,0.12)",
  },
  "kids-family": {
    label: "Family",
    bg: "#fff4df",
    bgSoft: "#fffbf3",
    fg: "#846018",
    ring: "#efdfb8",
    pattern: "rgba(132,96,24,0.12)",
  },
  fitness: {
    label: "Fitness",
    bg: "#edf6f8",
    bgSoft: "#f8fdff",
    fg: "#2e6674",
    ring: "#d1e6eb",
    pattern: "rgba(46,102,116,0.12)",
  },
  jewelry: {
    label: "Jewelry",
    bg: "#f5effa",
    bgSoft: "#fcf8ff",
    fg: "#69418c",
    ring: "#e2d5ef",
    pattern: "rgba(105,65,140,0.12)",
  },
  other: {
    label: "Local",
    bg: "#f1f5f9",
    bgSoft: "#ffffff",
    fg: "#475569",
    ring: "#dbe3ec",
    pattern: "rgba(71,85,105,0.12)",
  },
};

function toTrimmedString(value?: string | null): string | null {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function getSupabasePublicStorageBase(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return `${url.replace(/\/$/, "")}/storage/v1/object/public`;
}

function normalizeStoredBusinessImageUrl(value: string): string {
  const trimmed = value.trim();
  if (/^(https?:\/\/|data:|blob:)/i.test(trimmed)) return trimmed;
  const key = trimmed.replace(/^\/+/, "");
  if (
    /^(?:public\/)?(?:business-photos|business-gallery|listing-photos|profile-photos|avatars)\//i.test(
      key
    )
  ) {
    const base = getSupabasePublicStorageBase();
    if (base) return `${base}/${key}`;
    return `/${key}`;
  }
  return trimmed;
}

function normalizePath(value: string): string {
  try {
    return new URL(value, "https://yourbarrio.local").pathname;
  } catch {
    return value.split("?")[0]?.split("#")[0] || value;
  }
}

function firstRealImageUrl(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const value = toTrimmedString(candidate);
    if (value && !isKnownBusinessPlaceholderImage(value)) {
      return normalizeStoredBusinessImageUrl(value);
    }
  }
  return null;
}

function getMediaAssetPurpose(asset?: Record<string, unknown> | null): string {
  return String(asset?.purpose || "").trim();
}

function findMediaAssetByPurpose(
  business: BusinessImageInput,
  purposes: Set<string>
): Record<string, unknown> | null {
  const candidates = [
    business.business_avatar_media_asset,
    business.business_cover_media_asset,
    ...(Array.isArray(business.media_assets) ? business.media_assets : []),
  ].filter(Boolean) as Array<Record<string, unknown>>;

  return candidates.find((asset) => purposes.has(getMediaAssetPurpose(asset))) || null;
}

export function resolveBusinessAvatarUrl(business: BusinessImageInput = {}): string | null {
  const avatarAsset =
    findMediaAssetByPurpose(business, new Set(["business_avatar", "user_avatar"])) ||
    (business.avatar_256_path || business.avatar_128_path
      ? {
          bucket: business.bucket || "business-photos",
          avatar_256_path: business.avatar_256_path,
          avatar_128_path: business.avatar_128_path,
        }
      : null);
  const mediaAssetUrl = avatarAsset
    ? resolveMediaAssetUrl(avatarAsset, "avatar_profile")
    : null;
  return firstRealImageUrl([
    mediaAssetUrl,
    business.avatar_url,
    business.logo_url,
    business.profile_photo_url,
  ]);
}

export function resolveBusinessCoverUrl(business: BusinessImageInput = {}): string | null {
  const coverAsset =
    findMediaAssetByPurpose(business, new Set(["business_cover"])) ||
    (business.cover_desktop_path || business.cover_mobile_path
      ? {
          bucket: business.bucket || "business-photos",
          cover_desktop_path: business.cover_desktop_path,
          cover_mobile_path: business.cover_mobile_path,
        }
      : null);
  const mediaAssetUrl = coverAsset
    ? resolveMediaAssetUrl(coverAsset, "business_cover_desktop")
    : null;
  return firstRealImageUrl([mediaAssetUrl, business.cover_photo_url]);
}

function getBusinessTypeValue(business: BusinessImageInput = {}) {
  return (
    business.business_type ||
    business.businessTypeSlug ||
    business.businessTypeName ||
    business.categoryLabel ||
    business.category ||
    null
  );
}

export function isKnownBusinessPlaceholderImage(value?: string | null): boolean {
  const src = toTrimmedString(value);
  if (!src) return false;
  const path = normalizePath(src);
  return DEMO_PLACEHOLDER_PATH_RE.test(src) || LEGACY_PLACEHOLDER_PATHS.has(path);
}

export function getBusinessInitials(business: BusinessImageInput = {}): string {
  const source =
    toTrimmedString(business.business_name) ||
    toTrimmedString(business.name) ||
    toTrimmedString(business.full_name) ||
    "Local business";
  const words = source
    .replace(/&/g, " ")
    .split(/\s+/)
    .map((word) => word.match(/[A-Za-z0-9]/)?.[0] || "")
    .filter(Boolean);

  if (!words.length) return "YB";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function getBusinessCategoryAccent(
  businessType?: string | null
): BusinessCategoryAccent {
  const slug = normalizeBusinessTypeSlug(businessType) || "other";
  const accent = CATEGORY_ACCENTS[slug] || CATEGORY_ACCENTS.other;
  return { slug, ...accent };
}

export function getBusinessAvatarImage(
  business: BusinessImageInput = {}
): BusinessAvatarImage {
  const src = resolveBusinessAvatarUrl(business);
  if (src) return { kind: "image", src };

  return {
    kind: "placeholder",
    initials: getBusinessInitials(business),
    accent: getBusinessCategoryAccent(getBusinessTypeValue(business)),
    label: getBusinessTypeValue(business) || "Local business",
  };
}

export function getBusinessCoverImage(business: BusinessImageInput = {}): string | null {
  return resolveBusinessCoverUrl(business);
}

export function isRealBusinessCoverImage(business: BusinessImageInput = {}): boolean {
  return Boolean(getBusinessCoverImage(business));
}

export function getOnboardingDemoBusinessImage(category?: string | null): string {
  const slug = normalizeBusinessTypeSlug(category) || "boutique";
  if (!ONBOARDING_DEMO_SLUGS.has(slug)) return DEFAULT_ONBOARDING_DEMO_IMAGE;
  return `${ONBOARDING_DEMO_BASE}/${slug}.png`;
}

export const onboardingDemoCardImage = DEFAULT_ONBOARDING_DEMO_IMAGE;

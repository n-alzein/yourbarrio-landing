import { BUSINESS_CATEGORIES, CATEGORY_BY_SLUG } from "@/lib/businessCategories";
import { logServerTiming, perfTimingEnabled } from "@/lib/serverTiming";

type StrapiResponse<T> = {
  data: T;
  meta?: unknown;
  error?: { message?: string };
};

export const STRAPI_URL = (process.env.STRAPI_URL || "http://localhost:1337").replace(/\/+$/, "");

export function strapiAbsoluteUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  if (pathOrUrl.startsWith("/")) return `${STRAPI_URL}${pathOrUrl}`;
  return `${STRAPI_URL}/${pathOrUrl}`;
}

type StrapiFetchOptions = {
  revalidate?: number;
  init?: RequestInit;
  retries?: number;
  retryBaseDelayMs?: number;
  dedupe?: boolean;
};

function getStrapiDebugStack() {
  const stack = new Error().stack;
  if (!stack) return "";
  return stack
    .split("\n")
    .slice(2, 6)
    .map((line) => line.trim())
    .join(" | ");
}

function getStrapiRequestId() {
  const globalRef = globalThis as { __strapiFetchRequestId?: number };
  const nextId = (globalRef.__strapiFetchRequestId ?? 0) + 1;
  globalRef.__strapiFetchRequestId = nextId;
  return nextId;
}

function getStrapiInFlightMap() {
  const globalRef = globalThis as { __strapiFetchInFlight?: Map<string, Promise<unknown>> };
  if (!globalRef.__strapiFetchInFlight) {
    globalRef.__strapiFetchInFlight = new Map();
  }
  return globalRef.__strapiFetchInFlight;
}

export async function strapiFetch<T>(
  path: string,
  options: StrapiFetchOptions = {},
): Promise<T> {
  const timingEnabled = perfTimingEnabled();
  const timingStart = timingEnabled ? performance.now() : 0;
  const baseUrl = process.env.STRAPI_URL;
  const token = process.env.STRAPI_API_TOKEN;

  if (!baseUrl) {
    throw new Error("Missing STRAPI_URL. Set it in your server environment variables.");
  }
  if (!token) {
    throw new Error("Missing STRAPI_API_TOKEN. Set it in your server environment variables.");
  }

  const base = baseUrl.replace(/\/+$/, "");
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (base.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    normalizedPath = normalizedPath.replace(/^\/api/, "");
  }
  const url = `${base}${normalizedPath}`;
  const debugEnabled =
    process.env.NODE_ENV === "development" || process.env.DEBUG_STRAPI_FETCH === "true";
  const requestId = debugEnabled ? getStrapiRequestId() : 0;
  const method = (options.init?.method ?? "GET").toUpperCase();
  const retries = Math.max(0, options.retries ?? 2);
  const retryBaseDelayMs = Math.max(50, options.retryBaseDelayMs ?? 200);
  const dedupe = options.dedupe !== false && method === "GET";

  const runFetch = async () => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      let response: Response | null = null;
      try {
        response = await fetch(url, {
          ...options.init,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.init?.headers ?? {}),
          },
          next: { revalidate: options.revalidate ?? 60 },
        });

        if (debugEnabled) {
          const stack = getStrapiDebugStack();
          console.log(
            `[strapiFetch] #${requestId} ${method} ${url} status=${response.status} retry=${attempt}${stack ? ` stack=${stack}` : ""}`,
          );
        }

        if (response.ok) {
          const json = (await response.json()) as StrapiResponse<T>;
          return json?.data;
        }

        if (response.status >= 400 && response.status < 500) {
          const rawBody = await response.text().catch(() => "");
          let message = `${response.status} ${response.statusText}`;
          try {
            const errorBody = rawBody ? (JSON.parse(rawBody) as StrapiResponse<unknown>) : null;
            message = errorBody?.error?.message || (errorBody as any)?.message || message;
          } catch {
            // Ignore JSON parse errors for non-JSON responses.
          }
          const bodySnippet = rawBody ? ` - ${rawBody.slice(0, 400)}` : "";
          throw new Error(`Strapi request failed (${response.status}): ${message}${bodySnippet}`);
        }

        if (attempt < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryBaseDelayMs * Math.pow(2, attempt)),
          );
          continue;
        }

        const rawBody = await response.text().catch(() => "");
        const bodySnippet = rawBody ? ` - ${rawBody.slice(0, 400)}` : "";
        throw new Error(
          `Strapi request failed (${response.status}): ${response.statusText}${bodySnippet}`,
        );
      } catch (error) {
        lastError = error as Error;
        if (debugEnabled && !response) {
          const stack = getStrapiDebugStack();
          console.log(
            `[strapiFetch] #${requestId} ${method} ${url} status=ERR retry=${attempt}${stack ? ` stack=${stack}` : ""}`,
          );
        }
        if (attempt >= retries) break;
        await new Promise((resolve) =>
          setTimeout(resolve, retryBaseDelayMs * Math.pow(2, attempt)),
        );
      }
    }
    throw lastError ?? new Error("Strapi request failed.");
  };

  if (!dedupe) {
    const result = await runFetch();
    if (timingEnabled) {
      logServerTiming("strapiFetch", {
        path: normalizedPath,
        durationMs: Math.round(performance.now() - timingStart),
      });
    }
    return result;
  }

  const inFlight = getStrapiInFlightMap();
  const key = `${method} ${url}`;
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = runFetch()
    .finally(() => {
      inFlight.delete(key);
    })
    .catch((error) => {
      throw error;
    });
  if (timingEnabled) {
    promise
      .then(() => {
        logServerTiming("strapiFetch", {
          path: normalizedPath,
          durationMs: Math.round(performance.now() - timingStart),
          dedupe: Boolean(existing),
        });
      })
      .catch(() => {
        logServerTiming("strapiFetch_error", {
          path: normalizedPath,
          durationMs: Math.round(performance.now() - timingStart),
          dedupe: Boolean(existing),
        });
      });
  }
  inFlight.set(key, promise);
  return promise;
}

export async function fetchStrapiBanners() {
  return strapiFetch<any[]>("/api/banners?populate=*", { revalidate: 60 });
}

type StrapiMediaAttributes = {
  url?: string | null;
  formats?: Record<string, { url?: string | null }> | null;
};

type StrapiMediaEntity =
  | { data?: { attributes?: StrapiMediaAttributes | null } | null }
  | StrapiMediaAttributes
  | null;

type StrapiEntity<T> = {
  id?: number | string;
  attributes?: T;
};

type CategoryAttributes = {
  name?: string | null;
  slug?: string | null;
  tileSubtitle?: string | null;
  homeOrder?: number | null;
  tileImage?: StrapiMediaEntity;
  tileColor?: string | null;
};

type CategoryEntity = StrapiEntity<CategoryAttributes> | CategoryAttributes;

export type FeaturedCategory = {
  id: string;
  name: string;
  slug: string;
  tileSubtitle: string | null;
  homeOrder: number;
  tileImageUrl: string | null;
  tileImageFormats: Record<string, { url?: string | null }> | null;
  tileColor: string | null;
};

function isStrapiEntity<T extends object>(
  value: StrapiEntity<T> | T | null | undefined,
): value is StrapiEntity<T> {
  return !!value && typeof value === "object" && "attributes" in value;
}

function isStrapiNotFound(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = (error as { message?: string }).message || "";
  return message.includes("Strapi request failed (404)");
}

function buildFallbackCategory(
  category: { name: string; slug: string },
  index = 0,
): FeaturedCategory {
  const { name, slug } = category;
  return {
    id: `fallback-${index}-${slug}`,
    name,
    slug,
    tileSubtitle: null,
    homeOrder: index,
    tileImageUrl: null,
    tileImageFormats: null,
    tileColor: null,
  };
}

function getFallbackCategories() {
  return BUSINESS_CATEGORIES.map((category, index) =>
    buildFallbackCategory(category, index),
  );
}

function getFallbackCategoryBySlug(slug: string) {
  const normalized = slug.trim().toLowerCase();
  const match = CATEGORY_BY_SLUG.get(normalized);
  return match ? buildFallbackCategory(match) : null;
}

function resolveStrapiMedia(
  media: StrapiMediaEntity | undefined | null,
): StrapiMediaAttributes | null {
  if (!media) return null;
  if ("data" in media) {
    return media.data?.attributes ?? null;
  }
  return media as StrapiMediaAttributes;
}

function normalizeCategoryEntity(entity: CategoryEntity | null | undefined) {
  if (!entity) return null;
  const attributes: CategoryAttributes | null = isStrapiEntity(entity)
    ? entity.attributes ?? null
    : entity;
  const name = attributes?.name?.trim();
  const slug = attributes?.slug?.trim();
  if (!name || !slug) return null;
  const media = resolveStrapiMedia(attributes?.tileImage);
  const imageCandidate =
    media?.formats?.small?.url ||
    media?.formats?.thumbnail?.url ||
    media?.url ||
    null;
  const entityId = isStrapiEntity(entity) ? entity.id ?? null : null;
  return {
    id: String(entityId ?? attributes?.slug ?? slug),
    name,
    slug,
    tileSubtitle: attributes?.tileSubtitle ?? null,
    homeOrder: Number(attributes?.homeOrder ?? 0),
    tileImageUrl: strapiAbsoluteUrl(imageCandidate),
    tileImageFormats: media?.formats ?? null,
    tileColor: attributes?.tileColor ?? null,
  };
}

export async function fetchFeaturedCategories() {
  const params = new URLSearchParams();
  params.set("filters[showOnHome][$eq]", "true");
  params.set("sort[0]", "homeOrder:asc");
  params.set("fields[0]", "name");
  params.set("fields[1]", "slug");
  params.set("fields[2]", "tileSubtitle");
  params.set("fields[3]", "homeOrder");
  params.set("fields[4]", "tileColor");
  params.set("populate[tileImage]", "true");
  const path = `/api/categories?${params.toString()}`;
  if (
    process.env.NODE_ENV === "development" &&
    !(globalThis as { __featuredCategoriesLogged?: boolean }).__featuredCategoriesLogged
  ) {
    (globalThis as { __featuredCategoriesLogged?: boolean }).__featuredCategoriesLogged = true;
    const baseUrl = process.env.STRAPI_URL || "";
    const url = `${baseUrl.replace(/\/+$/, "")}${path}`;
    console.log("[fetchFeaturedCategories] url:", url);
  }
  let data: CategoryEntity[] | null = null;
  try {
    data = await strapiFetch<CategoryEntity[]>(path, { revalidate: 60 });
  } catch (error) {
    if (!isStrapiNotFound(error)) {
      console.warn("[fetchFeaturedCategories] falling back to local categories:", error);
    }
    return getFallbackCategories();
  }
  return (data ?? [])
    .map((entity) => normalizeCategoryEntity(entity))
    .filter((entry): entry is FeaturedCategory => Boolean(entry));
}

export async function fetchCategoryBySlug(slug: string) {
  if (!slug) return null;
  const params = new URLSearchParams();
  params.set("filters[slug][$eq]", slug);
  params.set("fields[0]", "name");
  params.set("fields[1]", "slug");
  params.set("fields[2]", "tileSubtitle");
  params.set("fields[3]", "homeOrder");
  params.set("fields[4]", "tileColor");
  params.set("populate[tileImage]", "true");
  let data: CategoryEntity[] | null = null;
  try {
    data = await strapiFetch<CategoryEntity[]>(
      `/api/categories?${params.toString()}`,
      { revalidate: 60 },
    );
  } catch (error) {
    if (isStrapiNotFound(error)) {
      return getFallbackCategoryBySlug(slug);
    }
    throw error;
  }
  const first = Array.isArray(data) ? data[0] : null;
  return normalizeCategoryEntity(first);
}

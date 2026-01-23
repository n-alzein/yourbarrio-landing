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

export async function strapiFetch<T>(
  path: string,
  options: { revalidate?: number; init?: RequestInit } = {},
): Promise<T> {
  const baseUrl = process.env.STRAPI_URL;
  const token = process.env.STRAPI_API_TOKEN;

  if (!baseUrl) {
    throw new Error("Missing STRAPI_URL. Set it in your server environment variables.");
  }
  if (!token) {
    throw new Error("Missing STRAPI_API_TOKEN. Set it in your server environment variables.");
  }

  const url = `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...options.init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.init?.headers ?? {}),
    },
    next: { revalidate: options.revalidate ?? 60 },
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const errorBody = (await response.json()) as StrapiResponse<unknown>;
      message = errorBody?.error?.message || (errorBody as any)?.message || message;
    } catch {
      // Ignore JSON parse errors for non-JSON responses.
    }
    throw new Error(`Strapi request failed: ${message}`);
  }

  const json = (await response.json()) as StrapiResponse<T>;
  return json?.data;
}

export async function fetchStrapiBanners() {
  return strapiFetch<any[]>("/api/banners?populate=*", { revalidate: 60 });
}

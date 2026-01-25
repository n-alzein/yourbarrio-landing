import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getCookieBaseOptions } from "@/lib/authCookies";

function ensureSupabaseEnv() {
  const missing = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (missing.length && process.env.NODE_ENV !== "production") {
    throw new Error(`Missing Supabase env: ${missing.join(", ")}`);
  }
  return missing.length === 0;
}

function buildServerClient({ getAll, setAll, cookieOptions }) {
  if (!ensureSupabaseEnv()) return null;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions,
      cookies: {
        getAll,
        setAll,
      },
    }
  );
}

export const getSupabaseServerClient = cache(async () => {
  const cookieStore = await cookies();
  const host = (await headers()).get("host");
  const isProd = process.env.NODE_ENV === "production";
  const cookieBaseOptions = getCookieBaseOptions({ host, isProd });

  if (typeof cookieStore?.getAll !== "function") {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        `getSupabaseServerClient expected cookieStore.getAll(), got ${typeof cookieStore}`
      );
    }
  }

  return buildServerClient({
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, {
            ...options,
            ...cookieBaseOptions,
          });
        });
      } catch {}
    },
  });
});

export function createSupabaseRouteHandlerClient(
  request,
  response,
  { cookieName } = {}
) {
  const host = request.headers.get("host");
  const isProd = process.env.NODE_ENV === "production";
  const cookieBaseOptions = getCookieBaseOptions({ host, isProd });

  return buildServerClient({
    cookieOptions: cookieName ? { name: cookieName } : undefined,
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, {
          ...options,
          ...cookieBaseOptions,
        });
      });
    },
  });
}

export const getUserCached = cache(async (supabaseOverride) => {
  const supabase = supabaseOverride ?? (await getSupabaseServerClient());
  if (!supabase?.auth?.getUser) {
    return { user: null, error: null };
  }
  const { data, error } = await supabase.auth.getUser();
  return { user: data?.user ?? null, error };
});

export const getProfileCached = cache(async (userId, supabaseOverride) => {
  if (!userId) return null;
  const supabase = supabaseOverride ?? (await getSupabaseServerClient());
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  return data ?? null;
});

export function isRefreshTokenAlreadyUsedError(error) {
  if (!error) return false;
  if (error?.code === "refresh_token_already_used") return true;
  const message = String(error?.message || "").toLowerCase();
  return message.includes("refresh_token_already_used");
}

export const createSupabaseServerClient = getSupabaseServerClient;

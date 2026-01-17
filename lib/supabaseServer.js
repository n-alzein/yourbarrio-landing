import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { getCookieBaseOptions } from "@/lib/authCookies";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const host = (await headers()).get("host");
  const isProd = process.env.NODE_ENV === "production";
  const cookieBaseOptions = getCookieBaseOptions({ host, isProd });
  if (typeof cookieStore?.getAll !== "function") {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        `createSupabaseServerClient expected cookieStore.getAll(), got ${typeof cookieStore}`
      );
    }
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server Components can't set cookies directly
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                ...cookieBaseOptions,
              });
            });
          } catch {}
        },
      },
    }
  );
}

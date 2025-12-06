// middleware.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req) {
  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll(cookiesToSet) {
          res = NextResponse.next({ request: { headers: req.headers } });
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;

  /* ---------------------------------------------------------
     0️⃣ ALWAYS ALLOW OAUTH CALLBACK
  --------------------------------------------------------- */
  if (path === "/oauth/callback") {
    return res; // no redirects ever
  }

  /* ---------------------------------------------------------
     1️⃣ PUBLIC ROUTES
  --------------------------------------------------------- */
  const publicRoutes = [
    "/",
    "/auth/login",
    "/auth/register",
    "/business-auth/login",
    "/business-auth/register",
    "/business",
    "/business/about",
  ];

  const isPublic = publicRoutes.includes(path);

  if (session && isPublic) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profile?.role === "business") {
      return NextResponse.redirect(new URL("/business/dashboard", req.url));
    }

    return NextResponse.redirect(new URL("/customer/home", req.url));
  }

  /* ---------------------------------------------------------
     2️⃣ CUSTOMER ROUTES REQUIRE LOGIN
  --------------------------------------------------------- */
  if (path.startsWith("/customer")) {
    if (!session) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
  }

  /* ---------------------------------------------------------
     3️⃣ BUSINESS ROUTES (protected)
     `/business` and `/business/about` remain public
  --------------------------------------------------------- */
  if (path.startsWith("/business") && !["/business", "/business/about"].includes(path)) {
    if (!session) {
      return NextResponse.redirect(new URL("/business", req.url));
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profile?.role !== "business") {
      return NextResponse.redirect(new URL("/customer/home", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next|static|.*\\..*|favicon.ico).*)"],
};

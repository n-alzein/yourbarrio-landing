export async function GET(request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const token = process.env.ADMIN_ENV_TEST_TOKEN || "";
  if (!token) {
    return Response.json(
      { error: "Env test token not configured" },
      { status: 403 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const adminHeader = request.headers.get("x-admin-token") || "";
  const isAuthorized =
    authHeader === `Bearer ${token}` || adminHeader === token;

  if (!isAuthorized) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

import PublicNavbar from "@/components/navbars/PublicNavbar";
import BusinessNavbar from "@/components/navbars/BusinessNavbar";
import CustomerNavbar from "@/components/navbars/CustomerNavbar";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveRole(supabase, user) {
  const metaRole =
    user?.app_metadata?.role || user?.user_metadata?.role || null;
  if (metaRole) return metaRole;

  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Public role lookup failed", error);
  }

  return data?.role ?? null;
}

export default async function PublicLayout({ children }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let nav = null;
  if (!user) {
    nav = <PublicNavbar />;
  } else {
    const role = await resolveRole(supabase, user);
    if (role === "business") {
      nav = <BusinessNavbar />;
    } else if (role === "customer") {
      nav = <CustomerNavbar />;
    }
  }

  return (
    <>
      {nav}
      {children}
    </>
  );
}

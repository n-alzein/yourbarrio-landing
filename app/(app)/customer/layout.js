import { redirect } from "next/navigation";
import CustomerNavbar from "@/components/navbars/CustomerNavbar";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import InactivityLogout from "@/components/auth/InactivityLogout";

function CustomerRouteShell({ children = null }) {
  return <div className="pt-28 md:pt-20 min-h-screen">{children}</div>;
}

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
    console.error("Customer role lookup failed", error);
  }

  return data?.role ?? null;
}

export default async function CustomerLayout({ children }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const role = await resolveRole(supabase, user);
  if (role && role !== "customer") {
    redirect("/business/dashboard");
  }

  return (
    <>
      <CustomerNavbar />
      <InactivityLogout />
      <CustomerRouteShell>{children}</CustomerRouteShell>
    </>
  );
}

import { redirect } from "next/navigation";
import BusinessNavbar from "@/components/navbars/BusinessNavbar";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function BusinessRouteShell({ children = null }) {
  return <div className="pt-8 md:pt-10 min-h-screen">{children}</div>;
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
    console.error("Business role lookup failed", error);
  }

  return data?.role ?? null;
}

export default async function BusinessLayout({ children }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/business-auth/login");
  }

  const role = await resolveRole(supabase, user);
  if (role && role !== "business") {
    redirect("/customer/home");
  }

  return (
    <>
      <style>{`
        [data-public-nav] {
          display: none !important;
        }
      `}</style>
      <BusinessNavbar />
      <BusinessRouteShell>{children}</BusinessRouteShell>
    </>
  );
}

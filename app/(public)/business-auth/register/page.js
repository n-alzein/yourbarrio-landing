import { redirect } from "next/navigation";
import { getServerAuth, getProfile } from "@/lib/auth/server";
import { PATHS } from "@/lib/auth/paths";
import BusinessRegisterClient from "@/components/business-auth/BusinessRegisterClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessRegisterPage() {
  const { user } = await getServerAuth();

  if (user) {
    const profile = await getProfile(user.id);
    const role = profile?.role || user?.app_metadata?.role || user?.user_metadata?.role || null;
    if (role === "business") {
      redirect(PATHS.business.onboarding || "/business/onboarding");
    }
    redirect(PATHS.customer.home);
  }

  return <BusinessRegisterClient />;
}

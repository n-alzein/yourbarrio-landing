import { redirect } from "next/navigation";
import HomePageClient from "@/components/marketing/HomePageClient";
import { getServerAuth, getProfile } from "@/lib/auth/server";
import { PATHS } from "@/lib/auth/paths";
import HomeBanner from "@/components/HomeBanner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const { user } = await getServerAuth();

  if (user) {
    const profile = await getProfile(user.id);
    const role = profile?.role || user?.app_metadata?.role || null;
    if (role === "business") {
      redirect(PATHS.business.dashboard);
    }
    redirect(PATHS.customer.home);
  }

  return (
    <>
      <HomeBanner />
      <HomePageClient />
    </>
  );
}

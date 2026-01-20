import AuthSeed from "@/components/auth/AuthSeed";
import { getProfile, requireUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfileLayout({ children }) {
  const { user } = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <>
      <AuthSeed
        user={user}
        profile={profile}
        role={profile?.role ?? null}
      />
      {children}
    </>
  );
}

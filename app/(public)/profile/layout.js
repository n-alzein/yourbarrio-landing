import { AuthProvider } from "@/components/AuthProvider";
import { getProfile, requireUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfileLayout({ children }) {
  const { user } = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <AuthProvider
      initialUser={user}
      initialProfile={profile}
      initialRole={profile?.role ?? null}
    >
      {children}
    </AuthProvider>
  );
}

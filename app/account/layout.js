import { Suspense } from "react";
import GlobalHeader from "@/components/nav/GlobalHeader";
import InactivityLogout from "@/components/auth/InactivityLogout";
import AuthSeed from "@/components/auth/AuthSeed";
import { requireRole } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function AccountShell({ children = null }) {
  return <div className="pt-28 md:pt-20 min-h-screen">{children}</div>;
}

export default async function AccountLayout({ children }) {
  const { user, profile } = await requireRole("customer");

  return (
    <>
      <AuthSeed user={user} profile={profile} role="customer" />
      <Suspense fallback={null}>
        <GlobalHeader surface="customer" />
      </Suspense>
      <InactivityLogout />
      <AccountShell>
        <Suspense fallback={null}>{children}</Suspense>
      </AccountShell>
    </>
  );
}

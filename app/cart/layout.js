import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import GlobalHeader from "@/components/nav/GlobalHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CartLayout({ children }) {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <GlobalHeader surface="customer" />
      </Suspense>
      <div className="pt-28 md:pt-20 min-h-screen">{children}</div>
    </AppShell>
  );
}

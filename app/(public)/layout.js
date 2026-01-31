import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import GlobalHeader from "@/components/nav/GlobalHeader";
import GlobalHeaderGate from "@/components/nav/GlobalHeaderGate";
import BusinessAuthRedirector from "@/components/BusinessAuthRedirector";

export const metadata = {
  other: {
    "yb-shell": "public",
  },
};

export default function PublicLayout({ children }) {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <GlobalHeaderGate>
          <GlobalHeader surface="public" />
        </GlobalHeaderGate>
      </Suspense>
      <BusinessAuthRedirector />
      {children}
    </AppShell>
  );
}

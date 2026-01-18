import GlobalHeader from "@/components/nav/GlobalHeader";
import GlobalHeaderGate from "@/components/nav/GlobalHeaderGate";
import { AuthProvider } from "@/components/AuthProvider";
import BusinessAuthRedirector from "@/components/BusinessAuthRedirector";

export const metadata = {
  other: {
    "yb-shell": "public",
  },
};

export default function PublicLayout({ children }) {
  return (
    <AuthProvider>
      <GlobalHeaderGate>
        <GlobalHeader surface="public" />
      </GlobalHeaderGate>
      <BusinessAuthRedirector />
      {children}
    </AuthProvider>
  );
}

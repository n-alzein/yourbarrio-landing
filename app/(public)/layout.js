import GlobalHeader from "@/components/nav/GlobalHeader";
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
      <GlobalHeader surface="public" />
      <BusinessAuthRedirector />
      {children}
    </AuthProvider>
  );
}

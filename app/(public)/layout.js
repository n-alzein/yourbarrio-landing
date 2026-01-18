import PublicNavbar from "@/components/navbars/PublicNavbar";
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
      <PublicNavbar />
      <BusinessAuthRedirector />
      {children}
    </AuthProvider>
  );
}

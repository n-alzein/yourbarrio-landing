import BusinessAuthRedirector from "@/components/BusinessAuthRedirector";
import BusinessMarketingFooter from "@/components/marketing/BusinessMarketingFooter";

export const metadata = {
  other: {
    "yb-shell": "business-marketing",
  },
};

export default function BusinessMarketingLayout({ children }) {
  return (
    <>
      <BusinessAuthRedirector />
      {children}
      <BusinessMarketingFooter />
    </>
  );
}

import BusinessAuthRedirector from "@/components/BusinessAuthRedirector";

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
    </>
  );
}

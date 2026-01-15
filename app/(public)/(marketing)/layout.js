import CustomerPublicNavbar from "@/components/navbars/CustomerPublicNavbar";

export const metadata = {
  other: {
    "yb-shell": "public",
  },
};

export default function MarketingLayout({ children }) {
  return (
    <>
      <CustomerPublicNavbar />
      {children}
    </>
  );
}

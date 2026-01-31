import BusinessMarketingHeader from "@/components/headers/BusinessMarketingHeader";

function BusinessRouteShell({ children = null }) {
  return (
    <div className="yb-business-marketing min-h-screen">
      {children}
    </div>
  );
}

export default function BusinessLayout({ children }) {
  return (
    <>
      <BusinessMarketingHeader />
      <div className="h-16" aria-hidden="true" />
      <BusinessRouteShell>{children}</BusinessRouteShell>
    </>
  );
}

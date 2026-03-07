function BusinessRouteShell({ children = null }) {
  return (
    <div className="yb-business-marketing min-h-screen">
      {children}
    </div>
  );
}

export default function BusinessLayout({ children }) {
  return <BusinessRouteShell>{children}</BusinessRouteShell>;
}

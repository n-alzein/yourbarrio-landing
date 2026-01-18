function BusinessRouteShell({ children = null }) {
  return <div className="pt-8 md:pt-10 min-h-screen">{children}</div>;
}

export default function BusinessLayout({ children }) {
  return <BusinessRouteShell>{children}</BusinessRouteShell>;
}

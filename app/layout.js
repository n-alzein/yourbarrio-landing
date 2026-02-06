// app/layout.js
import "./globals.css";
import "./safari-layer-budget.css";
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "YourBarrio – Find What You Need Nearby",
  description: "YourBarrio neighborhood discovery landing page",
  other: {
    "yb-shell-root": "root",
  },
};

export default function RootLayout({ children }) {
  const imageHosts = (() => {
    const hosts = new Set();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      try {
        hosts.add(new URL(supabaseUrl).origin);
      } catch {}
    }
    return Array.from(hosts);
  })();

  return (
    <html lang="en" className="theme-light" data-scroll-behavior="smooth">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        {imageHosts.map((host) => (
          <link key={`preconnect-${host}`} rel="preconnect" href={host} />
        ))}
        {imageHosts.map((host) => (
          <link key={`dns-${host}`} rel="dns-prefetch" href={host} />
        ))}
      </head>
      <body className="min-h-screen w-full overflow-x-hidden antialiased text-white">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

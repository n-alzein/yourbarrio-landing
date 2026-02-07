import Link from "next/link";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/businesses", label: "Businesses" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/impersonation", label: "Support Mode" },
];

export default function AdminNav() {
  return (
    <nav className="grid gap-2">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 hover:border-neutral-600"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

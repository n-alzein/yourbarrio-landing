import Link from "next/link";
import { adminLogoutAction } from "@/app/admin/actions";

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
      <form action={adminLogoutAction}>
        <button
          type="submit"
          className="w-full rounded-md border border-red-900 bg-red-950 px-3 py-2 text-left text-sm text-red-100 hover:border-red-700"
        >
          Log out
        </button>
      </form>
    </nav>
  );
}

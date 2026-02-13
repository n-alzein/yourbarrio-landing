import Link from "next/link";
import type { ReactNode } from "react";

type AdminUserHeaderBarProps = {
  user: {
    id: string;
    public_id: string | null;
    email: string | null;
    full_name: string | null;
    role: string | null;
    is_internal: boolean | null;
  };
};

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-xs text-neutral-300">
      {children}
    </span>
  );
}

export default function AdminUserHeaderBar({ user }: AdminUserHeaderBarProps) {
  const displayName = user.full_name || user.email || "User";
  const userRef = `usr_${user.public_id || user.id.slice(0, 8)}`;

  return (
    <header className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-neutral-100">{displayName}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-xs text-neutral-300">
              {userRef}
            </code>
            <Chip>role: {user.role || "-"}</Chip>
            <Chip>{user.is_internal ? "internal" : "external"}</Chip>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <details className="text-xs text-neutral-500">
            <summary className="cursor-pointer">Internal ID</summary>
            <code className="mt-1 block max-w-[240px] break-all text-neutral-400">{user.id}</code>
          </details>
          <Link
            href="/admin/accounts"
            className="rounded border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-neutral-500"
          >
            Back to accounts
          </Link>
        </div>
      </div>
    </header>
  );
}

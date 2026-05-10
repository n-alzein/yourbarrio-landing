import AdminNav from "@/app/admin/_components/AdminNav";

type AdminSidebarProps = {
  roles: string[];
  emailOrId: string;
  strictPermissionBypassUsed: boolean;
  pendingVerificationCount?: number;
};

export default function AdminSidebar({
  roles,
  emailOrId,
  strictPermissionBypassUsed,
  pendingVerificationCount = 0,
}: AdminSidebarProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-2">
      <div className="mb-3 px-2 py-1.5 text-xs text-neutral-500">
        <p className="truncate">Signed in as</p>
        <p className="mt-0.5 truncate text-neutral-300">{emailOrId}</p>
      </div>

      <AdminNav
        roles={roles}
        strictPermissionBypassUsed={strictPermissionBypassUsed}
        variant="vertical"
        pendingVerificationCount={pendingVerificationCount}
      />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateUserRoleAction } from "@/app/admin/actions";
import StickySaveBar from "@/app/admin/users/[id]/_components/StickySaveBar";

type AdminUserRoleEditorProps = {
  userId: string;
  initialRole: string;
};

export default function AdminUserRoleEditor({ userId, initialRole }: AdminUserRoleEditorProps) {
  const [role, setRole] = useState(initialRole || "customer");
  const formId = `admin-user-role-${userId}`;
  const dirty = useMemo(() => role !== (initialRole || "customer"), [role, initialRole]);

  function handleCancel() {
    setRole(initialRole || "customer");
  }

  return (
    <form action={updateUserRoleAction} id={formId} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="mb-2 font-medium">Update app role</h3>
      <input type="hidden" name="userId" value={userId} />
      <input
        name="role"
        value={role}
        onChange={(event) => setRole(event.target.value)}
        className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
      />
      <RoleSaveBar dirty={dirty} onCancel={handleCancel} formId={formId} />
    </form>
  );
}

function RoleSaveBar({
  dirty,
  onCancel,
  formId,
}: {
  dirty: boolean;
  onCancel: () => void;
  formId: string;
}) {
  const { pending } = useFormStatus();

  return <StickySaveBar dirty={dirty} onCancel={onCancel} isSaving={pending} formId={formId} saveLabel="Save role" />;
}

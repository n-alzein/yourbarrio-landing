"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const CONFIRMATION = "HARD DELETE USER";

type Props = {
  targetUserId: string;
  actorRoleKeys?: string[] | null;
  isEligible?: boolean;
};

type Preview = {
  counts?: Record<string, number>;
  storage_objects?: Array<{ bucket: string; path: string }>;
  block_reason?: string | null;
};

const COUNT_LABELS: Record<string, string> = {
  user_profile: "User profile",
  auth_account: "Auth account",
  businesses: "Businesses",
  listings: "Listings",
  reviews: "Reviews",
  conversations: "Conversations",
  messages: "Messages",
  cart_items: "Cart items",
  carts: "Carts",
  reservations: "Reservations",
  media_assets: "Media assets",
  storage_files: "Storage files",
  orders: "Orders",
  order_items: "Order items",
  notifications: "Notifications",
};

export default function HardDeleteFakeTestAccountButton({
  targetUserId,
  actorRoleKeys,
  isEligible = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canUse = Array.isArray(actorRoleKeys) && actorRoleKeys.includes("admin_super");
  const countRows = useMemo(() => {
    const counts = preview?.counts || {};
    return Object.entries(COUNT_LABELS).map(([key, label]) => ({
      key,
      label,
      value: Number(counts[key] || 0),
    }));
  }, [preview]);

  if (!canUse) return null;

  async function loadPreview() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${targetUserId}/hard-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry_run" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPreview(payload?.preview || null);
        throw new Error(String(payload?.error || "Hard delete preview failed"));
      }
      setPreview(payload.preview || null);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Hard delete preview failed",
      });
    } finally {
      setPending(false);
    }
  }

  async function openModal() {
    setOpen(true);
    setConfirmation("");
    setPreview(null);
    await loadPreview();
  }

  async function execute() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${targetUserId}/hard-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "execute", confirmation }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || "Hard delete failed"));
      }
      setMessage({ type: "success", text: "Fake/test account permanently deleted." });
      setOpen(false);
      router.push("/admin/accounts");
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Hard delete failed",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={pending || !isEligible}
        title={
          isEligible
            ? undefined
            : "This user is not marked as fake, test, or internal. Use the normal account deletion/anonymization flow instead."
        }
        className="rounded border border-red-700/70 bg-red-950/60 px-3 py-2 text-sm font-medium text-red-100 hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Hard delete fake/test account
      </button>

      {!isEligible ? (
        <p className="mt-2 text-xs text-red-200/80">
          This user is not marked as fake, test, or internal. Use the normal account
          deletion/anonymization flow instead.
        </p>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hard-delete-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-4 shadow-xl">
            <h3 id="hard-delete-title" className="text-base font-semibold text-neutral-100">
              Hard delete fake/test account
            </h3>
            <p className="mt-2 text-sm text-red-100">
              This permanently deletes this fake/test account, its profile, related test
              content, conversations, reviews, carts, reservations, and media. This is intended
              only for pre-launch cleanup and cannot be undone.
            </p>

            <div className="mt-4 rounded border border-neutral-800 bg-neutral-950 p-3">
              {pending && !preview ? (
                <p className="text-sm text-neutral-300">Loading preview...</p>
              ) : (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {countRows.map((row) => (
                    <div key={row.key} className="contents">
                      <dt className="text-neutral-400">{row.label}</dt>
                      <dd className="text-right text-neutral-100">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {message ? (
              <p className={message.type === "error" ? "mt-3 text-sm text-red-200" : "mt-3 text-sm text-emerald-200"}>
                {message.text}
              </p>
            ) : null}

            <label className="mt-4 block text-sm text-neutral-200">
              Type HARD DELETE USER to continue
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-base text-neutral-100 md:text-sm"
              />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-neutral-500 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={execute}
                disabled={pending || confirmation !== CONFIRMATION || Boolean(preview?.block_reason)}
                className="rounded border border-red-700 bg-red-900 px-3 py-1.5 text-sm font-medium text-red-100 hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Deleting..." : "Hard delete fake/test account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

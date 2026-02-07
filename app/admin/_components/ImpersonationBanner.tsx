import { stopImpersonationAction } from "@/app/admin/actions";

export default function ImpersonationBanner({
  targetLabel,
  sessionId,
}: {
  targetLabel: string;
  sessionId: string;
}) {
  return (
    <div className="rounded-md border border-amber-700 bg-amber-950/70 px-3 py-2 text-sm text-amber-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>Viewing as {targetLabel}. This is support mode, not auth token impersonation.</p>
        <form action={stopImpersonationAction}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <button
            type="submit"
            className="rounded bg-amber-400 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-300"
          >
            Exit
          </button>
        </form>
      </div>
    </div>
  );
}

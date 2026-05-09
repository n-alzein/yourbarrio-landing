export default function ListingDetailsLoading() {
  return (
    <div
      className="min-h-[45vh] px-4 pb-10 pt-6 md:px-8 md:pb-12 md:pt-8 lg:px-12"
      style={{ background: "var(--background)", color: "var(--text)" }}
    >
      <div className="mx-auto flex max-w-6xl justify-center">
        <div
          className="w-full max-w-sm rounded-2xl border px-5 py-4 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)]"
          style={{ background: "var(--surface)", borderColor: "rgba(110,52,255,0.14)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(110,52,255,0.10)" }}
              aria-hidden="true"
            >
              <div
                className="h-4 w-4 animate-spin rounded-full border-2 border-transparent"
                style={{
                  borderTopColor: "rgba(110,52,255,0.95)",
                  borderRightColor: "rgba(110,52,255,0.35)",
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Loading listing...</p>
              <p className="mt-0.5 text-xs text-slate-500">Getting the latest details.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

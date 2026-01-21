export default function AccountOrdersLoading() {
  return (
    <div
      className="min-h-screen px-4 md:px-8 lg:px-12 py-12"
      style={{ background: "var(--background)", color: "var(--text)" }}
    >
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-black/10" />
          <div className="h-8 w-40 rounded bg-black/10" />
          <div className="h-4 w-64 rounded bg-black/10" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-24 rounded-full bg-black/10" />
          <div className="h-10 w-24 rounded-full bg-black/10" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="rounded-3xl p-6 animate-pulse"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-black/10" />
                  <div className="h-3 w-40 rounded bg-black/10" />
                  <div className="h-3 w-48 rounded bg-black/10" />
                </div>
                <div className="h-6 w-24 rounded-full bg-black/10" />
              </div>
              <div className="mt-4 grid md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((__, cardIndex) => (
                  <div key={`skeleton-card-${cardIndex}`} className="space-y-2">
                    <div className="h-3 w-24 rounded bg-black/10" />
                    <div className="h-4 w-36 rounded bg-black/10" />
                    <div className="h-3 w-28 rounded bg-black/10" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

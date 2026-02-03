export default function CategoryListingsLoading() {
  return (
    <section className="w-full px-5 sm:px-6 md:px-8 lg:px-12 py-6">
      <div className="max-w-6xl mx-auto">
        <div className="h-4 w-32 rounded bg-slate-100 animate-pulse" />
        <div className="mt-3 h-7 w-64 rounded bg-slate-200 animate-pulse" />
        <div className="mt-2 h-4 w-52 rounded bg-slate-100 animate-pulse" />
        <div className="mt-6 grid gap-4 sm:gap-5 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={`category-listing-skeleton-${idx}`}
              className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
            >
              <div className="h-36 sm:h-40 bg-slate-100 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-slate-200 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

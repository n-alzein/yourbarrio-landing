"use client";

export default function NearbySplitViewShell({
  mobileView,
  onMobileViewChange,
  renderMobileToggle = false,
  controls,
  resultsPane,
  mapPane,
}) {
  const viewMode = mobileView === "map" ? "map" : "list";

  return (
    <section
      className="relative flex min-h-[calc(100dvh-96px)] flex-col md:min-h-[calc(100dvh-108px)]"
      data-testid="nearby-splitview"
    >
      {renderMobileToggle ? (
        <div className="sticky top-[72px] z-30 mb-2 md:hidden">
          <div className="inline-flex rounded-xl border border-white/15 bg-black/40 p-1 backdrop-blur-xl">
            {[
              { key: "list", label: "List" },
              { key: "map", label: "Map" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onMobileViewChange(item.key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mobileView === item.key
                    ? "bg-violet-500/70 text-white shadow"
                    : "text-white/75 hover:text-white"
                }`}
                aria-pressed={mobileView === item.key}
                data-testid={`nearby-toggle-${item.key}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {controls ? <div className="mb-2.5 shrink-0" data-testid="nearby-header">{controls}</div> : null}

      <div
        className={`hidden min-h-0 flex-1 md:grid ${
          viewMode === "map" ? "md:grid-cols-1" : "md:grid-cols-[minmax(0,1fr)]"
        }`}
        data-testid="nearby-split-desktop"
      >
        <div
          className={`${viewMode === "list" ? "block" : "hidden"} min-h-0`}
        >
          <div className="h-full overflow-y-auto" data-testid="nearby-results-scroll-pane">
            {resultsPane}
          </div>
        </div>

        <div
          className={`${viewMode === "map" ? "block" : "hidden"} relative min-h-0 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white p-2 shadow-[0_24px_80px_rgba(15,23,42,0.08)]`}
          data-testid="nearby-map-pane"
        >
          <div className="h-full overflow-hidden rounded-[1.35rem] border border-slate-200">{mapPane}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 md:hidden">
        {viewMode === "list" ? (
          <div className="h-full min-h-0">
            <div className="h-full overflow-y-auto">{resultsPane}</div>
          </div>
        ) : (
          <div
            className="h-[72vh] min-h-[480px] overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white p-2 shadow-[0_18px_55px_rgba(15,23,42,0.08)]"
            data-testid="nearby-map-mobile-pane"
          >
            <div className="h-full overflow-hidden rounded-[1.35rem] border border-slate-200">{mapPane}</div>
          </div>
        )}
      </div>
    </section>
  );
}

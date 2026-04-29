"use client";

import NearbyBusinessCard from "./NearbyBusinessCard";

function NearbyCardSkeleton() {
  return (
    <div className="w-full animate-pulse overflow-hidden rounded-[1.45rem] border border-slate-200 bg-white shadow-sm">
      <div className="aspect-[16/9] bg-slate-100" />
      <div className="space-y-2 p-4">
        <div className="h-5 w-3/4 rounded bg-slate-100" />
        <div className="h-4 w-2/3 rounded bg-slate-100" />
        <div className="h-4 w-full rounded bg-slate-100" />
        <div className="h-4 w-32 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function NearbyResultsPane({
  businesses,
  visibleBusinesses,
  loading,
  error,
  isMobile = false,
  activeBusinessId,
  selectedBusinessId,
  onCardHover,
  onCardLeave,
  onCardClick,
  onCardMapFocusClick,
  onToggleSaveShop,
  savedBusinessIds,
  savingBusinessIds,
  showSaveControls = true,
  registerCard,
  hasMoreBusinesses = false,
  onLoadMore,
  onResetFilters,
}) {
  if (loading) {
    return (
      <div
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        data-testid="nearby-results-list"
        aria-busy="true"
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <NearbyCardSkeleton key={`nearby-skeleton-${index}`} />
        ))}
      </div>
    );
  }

  if (!businesses.length) {
    return (
      <div
        className="px-2 py-10 text-center"
        data-testid="nearby-results-empty"
      >
        <p className="text-lg font-semibold text-slate-950">
          {error ? "Growing in your area" : "No matches for these filters"}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          {error || "Explore local businesses near your area by clearing the current search or category filter."}
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:border-violet-200 hover:text-violet-700"
        >
          Reset filters
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="nearby-results-list">
        {(visibleBusinesses || businesses).map((business) => (
          <NearbyBusinessCard
            key={business.id || business.name}
            business={business}
            active={activeBusinessId === business.id}
            selected={selectedBusinessId === business.id}
            onHover={onCardHover}
            onLeave={onCardLeave}
            onClick={onCardClick}
            onMapFocusClick={onCardMapFocusClick}
            onToggleSave={onToggleSaveShop}
            isSaved={savedBusinessIds?.has?.(business.id)}
            saveLoading={savingBusinessIds?.has?.(business.id)}
            showSaveControl={showSaveControls}
            isMobile={isMobile}
            registerCard={registerCard}
          />
        ))}
      </div>

      {hasMoreBusinesses ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-medium text-violet-700 transition hover:border-violet-200 hover:text-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
          >
            Load more businesses
          </button>
        </div>
      ) : null}
    </div>
  );
}

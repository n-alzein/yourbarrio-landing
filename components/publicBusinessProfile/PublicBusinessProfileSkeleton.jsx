const softSkeletonBlockClass =
  "bg-[linear-gradient(135deg,rgba(248,250,252,0.98)_0%,rgba(241,245,249,0.94)_48%,rgba(248,250,252,0.98)_100%)]";

function ListingsCardSkeleton() {
  return (
    <div
      className="flex w-[calc((100%-1rem)/2)] min-w-[calc((100%-1rem)/2)] shrink-0 snap-start flex-col overflow-hidden rounded-[18px] border border-slate-100 bg-white shadow-sm sm:w-[18.5rem] sm:min-w-[18.5rem] md:w-[19.5rem] md:min-w-[19.5rem] lg:w-[18rem] lg:min-w-[18rem] xl:w-[17rem] xl:min-w-[17rem]"
      data-testid="public-business-profile-skeleton-listing-card"
    >
      <div
        className={`relative aspect-square overflow-hidden bg-slate-100 ${softSkeletonBlockClass}`}
      >
        <div className="absolute inset-[11%] rounded-[18px] border border-white/70 bg-white/35" />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="h-6 w-24 rounded-full bg-[#f6f1ff]" />
          <div className="h-4 w-14 rounded-full bg-slate-200/90" />
        </div>
        <div className="space-y-1.5">
          <div className="h-4 w-4/5 rounded-full bg-slate-200/85" />
          <div className="h-4 w-3/5 rounded-full bg-slate-200/70" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <div className="h-6 w-20 rounded-full bg-slate-100" />
          <div className="h-6 w-16 rounded-full bg-slate-100" />
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <div className="h-3 w-16 rounded-full bg-slate-100" />
          <div className="h-3 w-10 rounded-full bg-[#f1ebff]" />
        </div>
      </div>
    </div>
  );
}

export default function PublicBusinessProfileSkeleton({ withinProfileShell = false }) {
  const outerClassName = withinProfileShell
    ? "space-y-8 pb-12"
    : "min-h-[calc(100vh+5rem)] bg-[#f8fafc] text-slate-950";
  const contentShellClassName = withinProfileShell
    ? "mx-auto max-w-[1180px] px-0"
    : "mx-auto max-w-[1180px] px-4 pb-14 sm:px-6 md:px-8";

  return (
    <div className={outerClassName} data-testid="public-business-profile-skeleton">
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen">
        <div
          className={`relative h-[360px] overflow-hidden sm:h-[320px] md:h-[300px] lg:h-[260px] xl:h-[280px] ${softSkeletonBlockClass}`}
          data-testid="public-business-profile-skeleton-cover"
          data-business-cover-source="defaultFallback"
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.06)_0%,rgba(15,23,42,0)_38%,rgba(248,250,252,0.08)_62%,rgba(248,250,252,0.46)_89%,rgba(248,250,252,0.68)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,250,252,0.18)_0%,rgba(248,250,252,0.1)_26%,rgba(248,250,252,0.02)_60%,rgba(248,250,252,0.08)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[52%] bg-[radial-gradient(ellipse_at_28%_82%,rgba(248,250,252,0.54)_0%,rgba(248,250,252,0.28)_36%,rgba(248,250,252,0)_74%)]" />
          <div className="absolute bottom-0 left-0 h-[62%] w-[68%] bg-[radial-gradient(ellipse_at_30%_78%,rgba(248,250,252,0.72)_0%,rgba(248,250,252,0.52)_32%,rgba(248,250,252,0.18)_58%,rgba(248,250,252,0)_82%)]" />

          <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-5 sm:px-6 sm:pb-6 lg:px-8">
            <div className="mx-auto flex max-w-[1180px] flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:min-w-0 lg:flex-1">
                <div
                  className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-[20px] border border-white bg-slate-100 shadow-[0_18px_42px_-26px_rgba(15,23,42,0.55)] ring-1 ring-white/80 sm:h-24 sm:w-24 ${softSkeletonBlockClass}`}
                  data-testid="public-business-profile-skeleton-avatar"
                />
                <div className="min-w-0 flex-1">
                  <div className="h-9 w-56 rounded-full bg-slate-200/90 sm:h-11 sm:w-72" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="h-5 w-28 rounded-full bg-slate-100" />
                    <div className="h-5 w-24 rounded-full bg-slate-100" />
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-wrap gap-2 lg:w-fit lg:max-w-none lg:justify-end lg:self-end">
                <div className="h-10 w-28 rounded-full bg-slate-100" data-testid="public-business-profile-skeleton-action" />
                <div className="h-10 w-24 rounded-full bg-slate-100" />
                <div className="h-10 w-10 rounded-full bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={contentShellClassName}>
        <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen">

          <div className="sticky top-16 z-20 mb-5" data-testid="public-business-profile-skeleton-nav">
            <div className="border-y border-slate-200/85 bg-white/96 shadow-[0_14px_38px_-42px_rgba(15,23,42,0.35)] backdrop-blur">
              <div className="mx-auto max-w-[1180px] overflow-x-auto px-4 sm:px-6 lg:px-8">
                <div className="flex min-w-max gap-8">
                  <div className="h-12 w-12 border-b-2 border-[#6E34FF]" />
                  <div className="h-12 w-16 border-b-2 border-transparent" />
                  <div className="h-12 w-16 border-b-2 border-transparent" />
                  <div className="h-12 w-14 border-b-2 border-transparent" />
                  <div className="h-12 w-14 border-b-2 border-transparent" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-10 px-4 sm:px-6 md:space-y-12 lg:px-8">
          <section className="border-t border-slate-100 pt-8 md:pt-10" data-testid="public-business-profile-skeleton-about">
            <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10 xl:gap-12">
              <div className="min-w-0 max-w-[48rem] flex-1 space-y-4">
                <div className="h-7 w-24 rounded-full bg-slate-200/85" />
                <div className="space-y-2">
                  <div className="h-4 w-full rounded-full bg-slate-200/75" />
                  <div className="h-4 w-full rounded-full bg-slate-200/75" />
                  <div className="h-4 w-4/5 rounded-full bg-slate-200/65" />
                </div>
              </div>

              <div className="space-y-3 lg:w-[340px] lg:shrink-0">
                <div className="rounded-[20px] border border-slate-100/70 bg-white/85 p-4 shadow-[0_14px_34px_-32px_rgba(15,23,42,0.3)]">
                  <div className="mb-4 h-5 w-16 rounded-full bg-slate-200/85" />
                  <div className="space-y-4">
                    <div className="h-12 rounded-[14px] bg-slate-100" />
                    <div className="h-12 rounded-[14px] bg-slate-100" />
                    <div className="h-12 rounded-[14px] bg-slate-100" />
                  </div>
                </div>

                <div className="rounded-[20px] border border-slate-100/70 bg-white/85 p-4 shadow-[0_14px_34px_-32px_rgba(15,23,42,0.3)]" data-testid="public-business-profile-skeleton-hours">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-7 w-7 rounded-xl bg-[#faf8ff]" />
                    <div className="min-w-0 flex-1">
                      <div className="h-3 w-12 rounded-full bg-slate-100" />
                      <div className="mt-2 h-5 w-28 rounded-full bg-slate-200/85" />
                      <div className="mt-2 h-4 w-40 rounded-full bg-slate-200/65" />
                    </div>
                  </div>
                </div>

                <div className={`h-[210px] overflow-hidden rounded-[20px] border border-slate-100/70 bg-white/85 shadow-[0_14px_34px_-32px_rgba(15,23,42,0.3)] sm:h-[218px] lg:h-[252px] ${softSkeletonBlockClass}`} />
              </div>
            </div>
          </section>

          <section className="border-t border-slate-100 pt-8 md:pt-10" data-testid="public-business-profile-skeleton-listings">
            <div className="mb-4 max-w-2xl">
              <div className="h-7 w-28 rounded-full bg-slate-200/85" />
              <div className="mt-2 h-4 w-64 rounded-full bg-slate-200/65" />
            </div>
            <div className="-mx-1 px-1">
              <div className="flex snap-x snap-mandatory gap-4 overflow-hidden px-0.5 pb-2 pt-1">
                {Array.from({ length: 4 }).map((_, index) => (
                  <ListingsCardSkeleton key={index} />
                ))}
              </div>
            </div>
          </section>

          <section className="border-t border-slate-100 pt-8 md:pt-10" data-testid="public-business-profile-skeleton-updates">
            <div className="mb-4 max-w-2xl">
              <div className="h-7 w-24 rounded-full bg-slate-200/85" />
              <div className="mt-2 h-4 w-72 rounded-full bg-slate-200/65" />
            </div>
            <div className="grid gap-3">
              <div className="rounded-[16px] border border-slate-100 bg-white px-4 py-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-slate-100" />
                    <div className="space-y-2">
                      <div className="h-4 w-36 rounded-full bg-slate-200/85" />
                      <div className="h-3 w-20 rounded-full bg-slate-100" />
                    </div>
                  </div>
                  <div className="h-6 w-16 rounded-full bg-[#efe8ff]" />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-4 w-full rounded-full bg-slate-200/70" />
                  <div className="h-4 w-5/6 rounded-full bg-slate-200/60" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

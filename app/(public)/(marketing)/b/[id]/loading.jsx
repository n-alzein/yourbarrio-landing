export default function PublicBusinessProfileLoading() {
  return (
    <div className="min-h-screen text-white">
      <div className="h-[320px] sm:h-[380px] bg-gradient-to-br from-slate-900 via-purple-900/70 to-black" />
      <div className="-mt-20 sm:-mt-24">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 rounded-2xl bg-white/10" />
                <div className="space-y-3">
                  <div className="h-6 w-40 rounded bg-white/10" />
                  <div className="h-4 w-28 rounded bg-white/10" />
                  <div className="h-4 w-32 rounded bg-white/10" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-9 w-24 rounded-full bg-white/10" />
                <div className="h-9 w-24 rounded-full bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 md:px-10 pb-16 space-y-8 mt-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="h-5 w-32 rounded bg-white/10" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full rounded bg-white/10" />
            <div className="h-4 w-5/6 rounded bg-white/10" />
            <div className="h-4 w-4/6 rounded bg-white/10" />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8 space-y-4">
            <div className="h-5 w-40 rounded bg-white/10" />
            <div className="h-20 w-full rounded bg-white/10" />
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
            <div className="h-5 w-32 rounded bg-white/10" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="h-28 rounded bg-white/10" />
              <div className="h-28 rounded bg-white/10" />
              <div className="h-28 rounded bg-white/10" />
              <div className="h-28 rounded bg-white/10" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="h-5 w-32 rounded bg-white/10" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="h-40 rounded bg-white/10" />
            <div className="h-40 rounded bg-white/10" />
            <div className="h-40 rounded bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

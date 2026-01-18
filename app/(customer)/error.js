"use client";

export default function CustomerError({ error, reset }) {
  return (
    <div className="min-h-screen px-6 md:px-10 pt-24 text-white">
      <div className="max-w-xl mx-auto rounded-2xl border border-white/15 bg-white/5 p-8">
        <h1 className="text-2xl font-semibold">Customer page error</h1>
        <p className="mt-3 text-white/70">
          Something went wrong while loading this page. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

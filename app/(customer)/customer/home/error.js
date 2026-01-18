"use client";

export default function CustomerHomeError({ error, reset }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-white">
      <div className="max-w-md w-full space-y-4 text-center bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-sm text-white/70">
          {error?.message || "The page failed to load. Please try again."}
        </p>
        <button
          type="button"
          onClick={() => reset?.()}
          className="w-full py-3 rounded-xl font-semibold bg-white text-black hover:bg-white/90 transition"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

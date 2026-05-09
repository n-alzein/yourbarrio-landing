"use client";

export default function AppErrorFallback({ reset }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#172033] flex items-center justify-center px-6">
      <div className="max-w-md w-full space-y-4 text-center bg-white border border-[#dbe3ee] rounded-2xl p-6 shadow-xl">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-[#526070]">
          This page hit an unexpected issue.
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => reset?.()}
            className="w-full py-3 rounded-xl font-semibold bg-[#172033] text-white hover:bg-[#243047] transition"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="w-full py-3 rounded-xl font-semibold border border-[#cbd5e1] text-[#172033] hover:bg-[#f1f5f9] transition"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}

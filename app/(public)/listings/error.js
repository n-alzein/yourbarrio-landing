"use client";

import { useEffect } from "react";

export default function ListingsError({ error, reset }) {
  useEffect(() => {
    console.error("[LISTINGS][error-boundary]", {
      message: error?.message,
      stack: error?.stack,
    });
  }, [error]);

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700">
        <div className="font-semibold">Something went wrong</div>
        <p className="text-sm mt-1">
          We hit an unexpected error while loading listings.
        </p>
        <button
          type="button"
          className="mt-3 inline-flex items-center rounded-md border border-rose-200 bg-white px-3 py-1 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition"
          onClick={() => reset()}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

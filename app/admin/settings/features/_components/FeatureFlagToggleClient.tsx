"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type FeatureFlagToggleClientProps = {
  initialEnabled: boolean;
};

export default function FeatureFlagToggleClient({ initialEnabled }: FeatureFlagToggleClientProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onToggle = async () => {
    setError(null);
    const nextValue = !enabled;

    const response = await fetch("/api/admin/feature-flags/customer-nearby-public", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: nextValue }),
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error || "Failed to update feature flag");
      return;
    }

    const payload = await response.json().catch(() => null);
    setEnabled(payload?.enabled === true);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <>
      <span
        className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${
          enabled
            ? "border-emerald-700/70 bg-emerald-950/70 text-emerald-100"
            : "border-neutral-700 bg-neutral-950 text-neutral-200"
        }`}
        data-testid="nearby-public-state"
      >
        {enabled ? "Enabled" : "Disabled"}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-disabled={isPending}
        disabled={isPending}
        onClick={onToggle}
        data-testid="nearby-public-toggle"
        className={`inline-flex h-8 w-14 items-center rounded-full border p-1 transition ${
          enabled
            ? "justify-end border-emerald-600 bg-emerald-500/30"
            : "justify-start border-neutral-700 bg-neutral-800"
        } ${isPending ? "opacity-70" : ""}`}
      >
        <span className="h-5 w-5 rounded-full bg-white" />
        <span className="sr-only">Toggle public access to /customer/nearby</span>
      </button>

      {error ? (
        <p className="text-xs text-red-300" data-testid="nearby-public-toggle-error">
          {error}
        </p>
      ) : null}
    </>
  );
}

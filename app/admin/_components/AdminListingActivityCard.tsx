"use client";

import { useState } from "react";
import AdminListingActivityChart from "@/app/admin/_components/AdminListingActivityChart";
import AdminTimeRangeToggle, { type AdminChartRange } from "@/app/admin/_components/AdminTimeRangeToggle";

type ListingActivityRow = {
  bucketStart: string;
  label: string;
  realCreated: number;
  demoInternalCreated: number;
  totalCreated: number;
};

type AdminListingActivityCardProps = {
  ranges: Record<AdminChartRange, ListingActivityRow[]>;
};

export default function AdminListingActivityCard({ ranges }: AdminListingActivityCardProps) {
  const [selectedRange, setSelectedRange] = useState<AdminChartRange>("30d");
  const data = ranges[selectedRange] || ranges["30d"];

  return (
    <section className="rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-3 shadow-[0_16px_40px_-36px_rgba(0,0,0,0.9)] sm:p-4">
      <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-100">Listing activity</h3>
          <p className="mt-1 text-xs text-neutral-500">New listings created, split by real vs demo/internal</p>
        </div>
        <div className="shrink-0 self-start">
          <AdminTimeRangeToggle value={selectedRange} onChange={setSelectedRange} label="Listing activity range" />
        </div>
      </div>
      <AdminListingActivityChart data={data} />
    </section>
  );
}

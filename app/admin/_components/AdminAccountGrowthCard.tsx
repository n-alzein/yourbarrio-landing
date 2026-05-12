"use client";

import { useState } from "react";
import AdminTimeRangeToggle, { type AdminChartRange } from "@/app/admin/_components/AdminTimeRangeToggle";
import AdminUserSignupsChart from "@/app/admin/_components/AdminUserSignupsChart";
import { getCustomerBusinessAccountTotal } from "@/lib/admin/accountGrowth";

type SignupChartRow = {
  bucketStart: string;
  label: string;
  customerCount: number;
  businessCount: number;
};

type AdminAccountGrowthCardProps = {
  customers: number;
  businesses: number;
  ranges: Record<AdminChartRange, SignupChartRow[]>;
};

export default function AdminAccountGrowthCard({
  customers,
  businesses,
  ranges,
}: AdminAccountGrowthCardProps) {
  const [selectedRange, setSelectedRange] = useState<AdminChartRange>("30d");
  const data = ranges[selectedRange] || ranges["30d"];

  return (
    <section className="rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-3 shadow-[0_16px_40px_-36px_rgba(0,0,0,0.9)] sm:p-4">
      <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-100">Account growth</h3>
          <p className="mt-1 text-xs text-neutral-500">New customer and business accounts</p>
        </div>
        <div className="shrink-0 self-start">
          <AdminTimeRangeToggle value={selectedRange} onChange={setSelectedRange} label="Account growth range" />
        </div>
      </div>
      <AccountGrowthTotals customers={customers} businesses={businesses} />
      <AdminUserSignupsChart data={data} compact />
    </section>
  );
}

function AccountGrowthTotals({
  customers,
  businesses,
}: {
  customers: number;
  businesses: number;
}) {
  const customerBusinessTotal = getCustomerBusinessAccountTotal({ customers, businesses });

  return (
    <div className="mb-3">
      <p className="mb-1.5 text-[11px] font-medium text-neutral-600">Current totals</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <AccountGrowthTotal label="Total customers" value={customers} />
        <AccountGrowthTotal label="Total businesses" value={businesses} />
        <AccountGrowthTotal label="Customer + business accounts" value={customerBusinessTotal} />
      </div>
    </div>
  );
}

function AccountGrowthTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/[0.025] px-3 py-2">
      <p className="text-[11px] font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-100 sm:text-base">{value.toLocaleString()}</p>
    </div>
  );
}

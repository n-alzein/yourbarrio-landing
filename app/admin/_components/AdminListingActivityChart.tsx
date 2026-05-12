"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ListingActivityRow = {
  bucketStart: string;
  label: string;
  realCreated: number;
  demoInternalCreated: number;
  totalCreated: number;
};

type AdminListingActivityChartProps = {
  data: ListingActivityRow[];
};

const realColor = "#34d399";
const demoInternalColor = "#a78bfa";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dashboard-tooltip rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-neutral-100 shadow-lg">
      <p className="font-semibold text-neutral-50">{label}</p>
      <div className="mt-1 space-y-1">
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center justify-between gap-3">
            <span className="text-neutral-300">{entry.name}</span>
            <span className="font-semibold text-neutral-50">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function AdminListingActivityChart({ data }: AdminListingActivityChartProps) {
  const realTotal = data.reduce((sum, row) => sum + row.realCreated, 0);
  const demoInternalTotal = data.reduce((sum, row) => sum + row.demoInternalCreated, 0);
  const totalCreated = realTotal + demoInternalTotal;

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3 sm:mb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: realColor }} />
            Real
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: demoInternalColor }} />
            Demo/internal
          </span>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold text-neutral-50 sm:text-lg">{totalCreated.toLocaleString()}</p>
          <p className="text-xs text-neutral-500">created</p>
        </div>
      </div>
      <div className="h-36 w-full sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(115,115,115,0.18)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={18}
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="realCreated" name="Real" stackId="created" fill={realColor} radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="demoInternalCreated"
              name="Demo/internal"
              stackId="created"
              fill={demoInternalColor}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {totalCreated === 0 ? <p className="mt-2 text-xs text-neutral-500">No listings created in this window yet.</p> : null}
    </div>
  );
}

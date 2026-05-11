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

type SignupChartRow = {
  bucketStart: string;
  label: string;
  customerCount: number;
  businessCount: number;
};

type AdminUserSignupsChartProps = {
  data: SignupChartRow[];
  compact?: boolean;
};

const customerColor = "#38bdf8";
const businessColor = "#f59e0b";

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

export default function AdminUserSignupsChart({ data, compact = false }: AdminUserSignupsChartProps) {
  const totalCustomers = data.reduce((sum, row) => sum + row.customerCount, 0);
  const totalBusinesses = data.reduce((sum, row) => sum + row.businessCount, 0);
  const totalSignups = totalCustomers + totalBusinesses;

  return (
    <div>
      <div className="mb-2 flex items-center gap-3 text-[11px] text-neutral-500 sm:mb-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: customerColor }} />
          Customers
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: businessColor }} />
          Businesses
        </span>
      </div>
      <div className={compact ? "h-36 w-full sm:h-52" : "h-72 w-full"}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={compact ? { top: 8, right: 4, left: -24, bottom: 0 } : { top: 10, right: 10, left: -20, bottom: 10 }}>
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
            <Bar dataKey="customerCount" name="Customers" fill={customerColor} radius={[4, 4, 0, 0]} />
            <Bar dataKey="businessCount" name="Businesses" fill={businessColor} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {totalSignups === 0 ? (
        <p className="mt-2 text-xs text-neutral-500">No signup volume in this window yet.</p>
      ) : null}
    </div>
  );
}

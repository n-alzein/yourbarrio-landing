import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import KpiCard from "@/components/KpiCard";
import DashboardEmptyState from "@/components/DashboardEmptyState";
import type { KpiMetric } from "@/lib/dashboardTypes";

const metric: KpiMetric = {
  id: "net_sales",
  label: "Net Sales",
  value: "$12.4k",
  deltaPct: 4.2,
  sparklinePoints: [12, 14, 11, 15, 18, 16, 20],
  href: "/dashboard/sales",
};

describe("KpiCard", () => {
  it("renders KPI label, value, and delta", () => {
    render(<KpiCard metric={metric} />);

    expect(screen.getByText("Net Sales")).toBeInTheDocument();
    expect(screen.getByText("$12.4k")).toBeInTheDocument();
    expect(screen.getByText("+4.2%")).toBeInTheDocument();
    expect(screen.getByLabelText("Net Sales sparkline")).toBeInTheDocument();
  });
});

describe("DashboardEmptyState", () => {
  it("renders empty state messaging", () => {
    render(<DashboardEmptyState />);

    expect(screen.getByText("No activity in this range")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Try expanding the date range or clearing filters to surface more performance data."
      )
    ).toBeInTheDocument();
  });
});

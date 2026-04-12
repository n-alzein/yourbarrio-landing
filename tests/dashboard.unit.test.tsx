import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import KpiCard from "@/components/KpiCard";
import DashboardEmptyState from "@/components/DashboardEmptyState";
import DateRangeControls from "@/components/DateRangeControls";
import type { KpiMetric } from "@/lib/dashboardTypes";

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props) => {
    const { fill, priority, placeholder, blurDataURL, sizes, decoding, fetchPriority, ...rest } =
      props;
    return <img alt="" {...rest} />;
  },
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

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
    render(
      <DashboardEmptyState
        title="No activity in this range"
        description="Try expanding the date range or clearing filters to surface more performance data."
      />
    );

    expect(screen.getByText("No activity in this range")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Try expanding the date range or clearing filters to surface more performance data."
      )
    ).toBeInTheDocument();
  });
});

describe("DateRangeControls", () => {
  const baseProps = {
    dateRange: "30d" as const,
    filters: { categories: [] },
    categories: [],
    businessName: "Samsung Store",
    lastUpdated: "Just now",
    setupItems: [],
    onDateRangeChange: vi.fn(),
    onFiltersChange: vi.fn(),
  };

  it("keeps the initials fallback for whitespace-only avatar values", () => {
    render(<DateRangeControls {...baseProps} businessAvatarUrl="   " />);

    expect(screen.getByText("SS")).toBeInTheDocument();
    expect(screen.queryByAltText("Samsung Store profile image")).not.toBeInTheDocument();
  });

  it("falls back to initials when the avatar image fails to load", async () => {
    render(
      <DateRangeControls
        {...baseProps}
        businessAvatarUrl="https://crskbfbleiubpkvyvvlf.supabase.co/storage/v1/object/public/business-photos/example.jpg"
      />
    );

    const avatar = screen.getByAltText("Samsung Store profile image");
    fireEvent.error(avatar);

    await waitFor(() => {
      expect(screen.getByText("SS")).toBeInTheDocument();
    });
  });
});

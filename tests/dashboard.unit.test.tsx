import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import KpiCard from "@/components/KpiCard";
import DashboardEmptyState from "@/components/DashboardEmptyState";
import DateRangeControls from "@/components/DateRangeControls";
import TopProductsTable from "@/components/TopProductsTable";
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
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

describe("TopProductsTable", () => {
  it("shows the no-products empty state when no live products exist", () => {
    render(<TopProductsTable products={[]} totalLiveProductsCount={0} />);

    expect(screen.getByText("No products yet")).toBeInTheDocument();
    expect(screen.getByText("Add your first product to start selling.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add product" })).toHaveAttribute(
      "href",
      "/business/listings/new"
    );
  });

  it("shows the no-sales empty state when live products have no orders", () => {
    render(<TopProductsTable products={[]} totalLiveProductsCount={5} />);

    expect(screen.getByText("No sales yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your products are live — once customers place orders, your top products will appear here."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View listings" })).toHaveAttribute(
      "href",
      "/business/listings"
    );
  });

  it("renders top products when order-backed product data exists", () => {
    render(
      <TopProductsTable
        totalLiveProductsCount={5}
        products={[
          {
            id: "p1",
            name: "Cedar Candle",
            category: "Home Decor",
            revenue: 12840,
            orders: 240,
            inventoryQty: 120,
          },
        ]}
      />
    );

    expect(screen.getByText("Cedar Candle")).toBeInTheDocument();
    expect(screen.getByText("$12,840")).toBeInTheDocument();
    expect(screen.queryByText("No sales yet")).not.toBeInTheDocument();
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

    expect(screen.getAllByRole("img", { name: "Samsung Store profile image" })[0]).toHaveStyle({
      borderRadius: "1rem",
    });
    expect(screen.getAllByText("SS")[0]).toBeInTheDocument();
    expect(screen.queryByAltText("Samsung Store profile image")).not.toBeInTheDocument();
  });

  it("falls back to initials when the avatar image fails to load", async () => {
    render(
      <DateRangeControls
        {...baseProps}
        businessAvatarUrl="https://crskbfbleiubpkvyvvlf.supabase.co/storage/v1/object/public/business-photos/example.jpg"
      />
    );

    const avatar = screen.getAllByAltText("Samsung Store profile image")[0];
    fireEvent.error(avatar);

    await waitFor(() => {
      expect(screen.getByText("SS")).toBeInTheDocument();
    });
  });

  it("shows payout readiness as a blocker without adding a fourth setup step", () => {
    render(
      <DateRangeControls
        {...baseProps}
        setupItems={[
          { id: "profile", label: "Profile complete", complete: true },
          { id: "product", label: "First product", complete: true },
          { id: "profile_visibility", label: "Profile ready", complete: false },
        ]}
        payoutReadiness={{
          state: "needs_action",
          label: "Payments not ready",
          description: "Finish Stripe setup before payouts can be sent.",
        }}
      />
    );

    expect(screen.getByText("Setup in progress")).toBeInTheDocument();
    expect(screen.getByText("2 of 3 steps finished")).toBeInTheDocument();
    expect(screen.getByText("Payments not ready")).toBeInTheDocument();
    expect(screen.getByText("Finish Stripe setup before payouts can be sent.")).toBeInTheDocument();
    expect(screen.queryByText("Action required")).not.toBeInTheDocument();
    expect(screen.queryByText(/4 steps/i)).not.toBeInTheDocument();
  });

  it("does not show payout blocker when payout readiness is ready", () => {
    render(
      <DateRangeControls
        {...baseProps}
        setupItems={[
          { id: "profile", label: "Profile complete", complete: true },
          { id: "product", label: "First product", complete: true },
          { id: "profile_visibility", label: "Profile ready", complete: true },
        ]}
      />
    );

    expect(screen.queryByText("Payments not ready")).not.toBeInTheDocument();
    expect(screen.getAllByText("All setup steps completed")[0]).toBeInTheDocument();
  });
});

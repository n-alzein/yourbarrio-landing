import { fireEvent, render, screen, within } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import AdminAccountGrowthCard from "@/app/admin/_components/AdminAccountGrowthCard";
import AdminListingActivityCard from "@/app/admin/_components/AdminListingActivityCard";

vi.mock("recharts", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Bar: () => null,
    BarChart: passthrough,
    CartesianGrid: () => null,
    ResponsiveContainer: passthrough,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

const listingRanges = {
  "7d": [
    {
      bucketStart: "2026-05-06",
      label: "May 6",
      realCreated: 2,
      demoInternalCreated: 1,
      totalCreated: 3,
    },
  ],
  "30d": [
    {
      bucketStart: "2026-04-12",
      label: "Apr 12",
      realCreated: 10,
      demoInternalCreated: 5,
      totalCreated: 15,
    },
  ],
  ytd: [
    {
      bucketStart: "2026-01-01",
      label: "Jan 1",
      realCreated: 20,
      demoInternalCreated: 7,
      totalCreated: 27,
    },
  ],
};

const accountRanges = {
  "7d": [
    {
      bucketStart: "2026-05-06",
      label: "May 6",
      customerCount: 2,
      businessCount: 1,
    },
  ],
  "30d": [
    {
      bucketStart: "2026-04-12",
      label: "Apr 12",
      customerCount: 8,
      businessCount: 2,
    },
  ],
  ytd: [
    {
      bucketStart: "2026-01-01",
      label: "Jan 1",
      customerCount: 20,
      businessCount: 5,
    },
  ],
};

describe("admin dashboard chart ranges", () => {
  it("defaults listing activity to 30D and updates the created count", () => {
    render(<AdminListingActivityCard ranges={listingRanges} />);

    expect(screen.getByRole("button", { name: "30D" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("15")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "7D" }));
    expect(screen.getByRole("button", { name: "7D" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "YTD" }));
    expect(screen.getByText("27")).toBeInTheDocument();
  });

  it("updates account growth range count without changing current totals", () => {
    render(<AdminAccountGrowthCard customers={29} businesses={9} ranges={accountRanges} />);

    expect(screen.getByRole("button", { name: "30D" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("new accounts")).toBeInTheDocument();

    const totals = screen.getByText("Current totals").closest("div");
    expect(totals).not.toBeNull();
    expect(within(totals as HTMLElement).getByText("29")).toBeInTheDocument();
    expect(within(totals as HTMLElement).getByText("9")).toBeInTheDocument();
    expect(within(totals as HTMLElement).getByText("38")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "7D" }));
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(within(totals as HTMLElement).getByText("29")).toBeInTheDocument();
    expect(within(totals as HTMLElement).getByText("9")).toBeInTheDocument();
    expect(within(totals as HTMLElement).getByText("38")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "YTD" }));
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(within(totals as HTMLElement).getByText("38")).toBeInTheDocument();
  });
});

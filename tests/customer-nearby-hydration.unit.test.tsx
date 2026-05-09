import { render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: null, loadingUser: false }),
}));

vi.mock("@/components/auth/useBusinessProfileAccessGate", () => ({
  default: () => () => true,
}));

vi.mock("@/components/location/LocationProvider", () => ({
  useLocation: () => ({
    location: {
      city: "Long Beach",
      region: "CA",
      label: "Long Beach, CA",
      source: "manual",
    },
    hydrated: true,
    requestGpsLocation: vi.fn(),
  }),
}));

vi.mock("@/components/customer/CustomerMap", () => ({
  default: () => <div data-testid="mock-customer-map" />,
}));

vi.mock("@/lib/hooks/useSavedBusinesses", () => ({
  useSavedBusinesses: () => ({
    savedBusinessIds: new Set(),
    savingBusinessIds: new Set(),
    showSaveControls: false,
    toggleSavedBusiness: vi.fn(),
  }),
}));

import NearbyBusinessesClient from "@/app/(customer)/customer/nearby/NearbyBusinessesClient";

describe("NearbyBusinessesClient hydration", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ businesses: [], businessTypes: [] }),
      }))
    );
  });

  it("does not read cached empty nearby results during the first hydration render", async () => {
    sessionStorage.setItem(
      "yb_customer_nearby_businesses_citystate:long beach:CA",
      JSON.stringify({ businesses: [], loadedAt: Date.now() })
    );

    const serverHtml = renderToString(<NearbyBusinessesClient />);
    expect(serverHtml).toContain('data-testid="nearby-results-list"');
    expect(serverHtml).toContain('aria-busy="true"');
    expect(serverHtml).not.toContain('data-testid="nearby-results-empty"');

    render(<NearbyBusinessesClient />);

    await waitFor(() => {
      expect(screen.getAllByTestId("nearby-results-empty")[0]).toBeInTheDocument();
    });
  });
});

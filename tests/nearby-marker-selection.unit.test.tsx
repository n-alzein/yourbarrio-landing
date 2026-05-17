import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const stableLocation = {
  city: "Long Beach",
  region: "CA",
  lat: 33.7701,
  lng: -118.1937,
  label: "Long Beach, CA",
  source: "manual",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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
    location: stableLocation,
    hydrated: true,
    requestGpsLocation: vi.fn(),
  }),
}));

vi.mock("@/components/customer/CustomerMap", () => ({
  default: ({
    selectedBusinessId,
    selectedBusiness,
    onMarkerClick,
    onMarkerClear,
  }: {
    selectedBusinessId?: string | null;
    selectedBusiness?: { id?: string | null } | null;
    onMarkerClick?: (id: string) => void;
    onMarkerClear?: (id?: string | null) => void;
  }) => (
    <div
      data-testid="mock-customer-map"
      data-selected-id={selectedBusinessId || ""}
      data-selected-business-id={selectedBusiness?.id || ""}
    >
      <button type="button" onClick={() => onMarkerClick?.("marker-a")}>
        Marker A
      </button>
      <button type="button" onClick={() => onMarkerClick?.("marker-b")}>
        Marker B
      </button>
      <button type="button" onClick={() => onMarkerClear?.("marker-a")}>
        Close marker A
      </button>
      <button type="button" onClick={() => onMarkerClear?.()}>
        Clear map
      </button>
    </div>
  ),
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

const businessesPayload = {
  businessTypes: [{ id: "boutique", name: "Boutique", slug: "boutique" }],
  businesses: [
    {
      id: "marker-a",
      public_id: "marker-a-public",
      business_name: "Marker Alpha",
      category: "Boutique",
      business_type_slug: "boutique",
      city: "Long Beach",
      state: "CA",
      latitude: 33.7701,
      longitude: -118.1937,
    },
    {
      id: "marker-b",
      public_id: "marker-b-public",
      business_name: "Marker Beta",
      category: "Boutique",
      business_type_slug: "boutique",
      city: "Long Beach",
      state: "CA",
      latitude: 33.7711,
      longitude: -118.1927,
    },
  ],
};

const firstMarkerButton = (name: string) => screen.getAllByRole("button", { name })[0];
const expectEveryMockMapSelected = async (businessId: string) => {
  await waitFor(() => {
    for (const map of screen.getAllByTestId("mock-customer-map")) {
      expect(map).toHaveAttribute("data-selected-id", businessId);
    }
  });
};

describe("Nearby marker selection state", () => {
  beforeEach(() => {
    pushMock.mockClear();
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
        json: async () => businessesPayload,
      }))
    );
  });

  it("keeps marker clicks in map view and replaces selected marker state", async () => {
    render(<NearbyBusinessesClient />);

    await waitFor(() => expect(screen.getAllByText("Marker Alpha").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByTestId("nearby-toggle-map"));
    expect(screen.getByTestId("nearby-toggle-map")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(firstMarkerButton("Marker A"));
    expect(screen.getByTestId("nearby-toggle-map")).toHaveAttribute("aria-pressed", "true");
    await expectEveryMockMapSelected("marker-a");

    fireEvent.click(firstMarkerButton("Marker B"));
    await expectEveryMockMapSelected("marker-b");
    expect(screen.getByTestId("nearby-toggle-map")).toHaveAttribute("aria-pressed", "true");
  });

  it("clears selected marker on popup close, background clear, and explicit list mode", async () => {
    render(<NearbyBusinessesClient />);

    await waitFor(() => expect(screen.getAllByText("Marker Alpha").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByTestId("nearby-toggle-map"));

    fireEvent.click(firstMarkerButton("Marker A"));
    await expectEveryMockMapSelected("marker-a");

    fireEvent.click(firstMarkerButton("Close marker A"));
    await expectEveryMockMapSelected("");

    fireEvent.click(firstMarkerButton("Marker A"));
    await expectEveryMockMapSelected("marker-a");
    fireEvent.click(firstMarkerButton("Clear map"));
    await expectEveryMockMapSelected("");

    fireEvent.click(firstMarkerButton("Marker A"));
    await expectEveryMockMapSelected("marker-a");
    fireEvent.click(screen.getByTestId("nearby-toggle-list"));
    fireEvent.click(screen.getByTestId("nearby-toggle-map"));
    await expectEveryMockMapSelected("");
  });
});

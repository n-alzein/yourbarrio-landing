import { useEffect } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readLocationClientMock = vi.fn();
const setLocationCookieClientMock = vi.fn((next) => next);

vi.mock("@/lib/location/setLocationCookieClient", () => ({
  readLocationClient: (...args: any[]) => readLocationClientMock(...args),
  setLocationCookieClient: (...args: any[]) => setLocationCookieClientMock(...args),
}));

import { LocationProvider, useLocation } from "@/components/location/LocationProvider";
import { getDefaultLaunchLocation } from "@/lib/location/defaults";

function LocationProbe({ requestGpsOnHydrate = false }: { requestGpsOnHydrate?: boolean }) {
  const { location, hydrated, requestGpsLocation } = useLocation();

  useEffect(() => {
    if (!requestGpsOnHydrate || !hydrated) return;
    void requestGpsLocation();
  }, [hydrated, requestGpsLocation, requestGpsOnHydrate]);

  return (
    <>
      <div data-testid="hydrated">{hydrated ? "yes" : "no"}</div>
      <div data-testid="source">{location?.source || ""}</div>
      <div data-testid="city">{location?.city || ""}</div>
      <div data-testid="region">{location?.region || ""}</div>
    </>
  );
}

describe("launch-biased location bootstrap", () => {
  beforeEach(() => {
    readLocationClientMock.mockReset();
    setLocationCookieClientMock.mockClear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps Long Beach on first visit even if IP could resolve Los Angeles", async () => {
    readLocationClientMock.mockReturnValue(null);
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        city: "Los Angeles",
        region: "CA",
        country: "US",
        lat: 34.0522,
        lng: -118.2437,
      }),
    } as Response);

    render(
      <LocationProvider initialLocation={getDefaultLaunchLocation(100)}>
        <LocationProbe />
      </LocationProvider>
    );

    expect(screen.getByTestId("source").textContent).toBe("default");
    expect(screen.getByTestId("city").textContent).toBe("Long Beach");

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").textContent).toBe("yes");
    });

    expect(screen.getByTestId("source").textContent).toBe("default");
    expect(screen.getByTestId("city").textContent).toBe("Long Beach");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("preserves a saved manual location over launch default and any IP", async () => {
    readLocationClientMock.mockReturnValue({
      source: "manual",
      city: "San Diego",
      region: "CA",
      lat: 32.7157,
      lng: -117.1611,
      updatedAt: 200,
    });

    render(
      <LocationProvider initialLocation={getDefaultLaunchLocation(100)}>
        <LocationProbe />
      </LocationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").textContent).toBe("yes");
    });

    expect(screen.getByTestId("source").textContent).toBe("manual");
    expect(screen.getByTestId("city").textContent).toBe("San Diego");
  });

  it("preserves a saved GPS location over launch default and any IP", async () => {
    readLocationClientMock.mockReturnValue({
      source: "gps",
      city: "Anaheim",
      region: "CA",
      lat: 33.8366,
      lng: -117.9143,
      updatedAt: 300,
    });

    render(
      <LocationProvider initialLocation={getDefaultLaunchLocation(100)}>
        <LocationProbe />
      </LocationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").textContent).toBe("yes");
    });

    expect(screen.getByTestId("source").textContent).toBe("gps");
    expect(screen.getByTestId("city").textContent).toBe("Anaheim");
  });

  it("allows the nearby GPS flow to upgrade from launch default after hydration", async () => {
    readLocationClientMock.mockReturnValue(null);
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: any) =>
          success({
            coords: {
              latitude: 33.6595,
              longitude: -117.9988,
            },
          }),
      },
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        city: "Huntington Beach",
        region: "CA",
      }),
    } as Response);

    render(
      <LocationProvider initialLocation={getDefaultLaunchLocation(100)}>
        <LocationProbe requestGpsOnHydrate />
      </LocationProvider>
    );

    expect(screen.getByTestId("source").textContent).toBe("default");
    expect(screen.getByTestId("city").textContent).toBe("Long Beach");

    await waitFor(() => {
      expect(screen.getByTestId("source").textContent).toBe("gps");
    });

    expect(screen.getByTestId("city").textContent).toBe("Huntington Beach");
  });

  it("promotes a saved client-side manual city after SSR started from Long Beach", async () => {
    readLocationClientMock.mockReturnValue({
      source: "manual",
      city: "Pasadena",
      region: "CA",
      lat: 34.1478,
      lng: -118.1445,
      updatedAt: 400,
    });

    render(
      <LocationProvider initialLocation={getDefaultLaunchLocation(100)}>
        <LocationProbe />
      </LocationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("source").textContent).toBe("manual");
    });

    expect(screen.getByTestId("city").textContent).toBe("Pasadena");
  });
});

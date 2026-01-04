"use client";

import dynamic from "next/dynamic";
import React, { memo, useCallback, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

const mapDisabled = process.env.NEXT_PUBLIC_DISABLE_MAP === "1";
const GoogleMapClient = mapDisabled
  ? null
  : dynamic(() => import("@/components/GoogleMapClient"), {
      ssr: false,
      loading: () => (
        <div className="h-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-6 text-white/70 text-sm">
          Loading map…
        </div>
      ),
    });

function CustomerMap({
  mapEnabled = true,
  mapBusinesses,
  onBusinessesChange,
  onControlsReady,
  selectedBusiness,
  clickDiagEnabled,
}) {
  const [mapControls, setMapControls] = useState(null);
  const [searchingArea, setSearchingArea] = useState(false);

  const handleControlsReady = useCallback(
    (controls) => {
      setMapControls(controls);
      onControlsReady?.(controls);
    },
    [onControlsReady]
  );

  const handleSearchArea = async () => {
    if (!mapControls) return;
    setSearchingArea(true);
    try {
      if (!mapControls.placesEnabled?.()) {
        await mapControls.enablePlaces?.();
      } else {
        await mapControls.refresh?.();
      }
    } finally {
      setSearchingArea(false);
    }
  };

  const mapProps = useMemo(
    () => ({
      radiusKm: 25,
      showBusinessErrors: false,
      containerClassName: "w-full h-full",
      cardClassName:
        "h-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-4 text-white flex flex-col gap-3",
      mapClassName: "h-[55vh] sm:h-[60vh] md:h-[calc(100vh-320px)] w-full",
      title: "",
      enableCategoryFilter: false,
      enableSearch: true,
      placesMode: "manual",
      disableGooglePlaces: false,
      prefilledBusinesses: mapBusinesses,
      onBusinessesChange,
      onControlsReady: handleControlsReady,
    }),
    [mapBusinesses, onBusinessesChange, handleControlsReady]
  );

  if (!mapEnabled || !GoogleMapClient) {
    return (
      <div className="h-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-6 text-white/70 text-sm flex items-center">
        {mapDisabled ? "Map disabled for diagnostics" : "Map disabled (HOME_BISECT_MAP=0)"}
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col gap-3"
      data-clickdiag={clickDiagEnabled ? "map-modal" : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white/85 truncate">
          {selectedBusiness ? selectedBusiness.name : "Map"}
        </div>
        <button
          type="button"
          onClick={handleSearchArea}
          disabled={!mapControls || searchingArea}
          className="px-4 py-2 rounded-full border border-white/20 bg-white/10 text-sm font-semibold text-white hover:border-white/40 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
        >
          {searchingArea ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Search this area
        </button>
      </div>
      <div className="flex-1 min-h-[320px]">
        <GoogleMapClient {...mapProps} />
      </div>
    </div>
  );
}

export default memo(CustomerMap);

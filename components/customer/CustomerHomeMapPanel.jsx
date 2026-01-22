"use client";

import dynamic from "next/dynamic";
import React, { memo, useMemo } from "react";

const mapDisabled = process.env.NEXT_PUBLIC_DISABLE_MAP === "1";
const GoogleMapClient = mapDisabled
  ? null
  : dynamic(() => import("@/components/GoogleMapClient"), {
      ssr: false,
      loading: () => (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-3 text-white/70 text-sm">
          Loading map…
        </div>
      ),
    });

function CustomerHomeMapPanel({
  mapEnabled,
  mapBusinesses,
  onBusinessesChange,
  onControlsReady,
  selectedBusiness,
  clickDiagEnabled,
}) {
  const mapProps = useMemo(
    () => ({
      radiusKm: 25,
      showBusinessErrors: false,
      containerClassName: "w-full pointer-events-auto",
      cardClassName: "bg-transparent border-0 text-white",
      mapClassName:
        "h-64 sm:h-72 lg:h-[240px] w-full pointer-events-auto touch-pan-y touch-manipulation",
      title: "",
      enableCategoryFilter: false,
      enableSearch: false,
      placesMode: "manual",
      disableGooglePlaces: false,
      prefilledBusinesses: mapBusinesses,
      onBusinessesChange,
      onControlsReady,
    }),
    [mapBusinesses, onBusinessesChange, onControlsReady]
  );

  if (!mapEnabled || !GoogleMapClient) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-3 h-64 sm:h-72 lg:h-[240px] text-white/70 text-sm flex items-center">
        {mapDisabled ? "Map disabled for diagnostics" : "Map disabled (HOME_BISECT_MAP=0)"}
      </div>
    );
  }

  return (
    <div
      className="home-map-shell relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-3 z-0"
      data-clickdiag={clickDiagEnabled ? "map-shell" : undefined}
      data-home-map-shell="1"
    >
      <div className="flex flex-wrap items-center justify-between mb-2 gap-3">
        <div>
          <div className="text-sm font-semibold text-white/85 truncate">
            {selectedBusiness ? selectedBusiness.name : "Map"}
          </div>
        </div>
      </div>
      <div className="home-map-viewport relative overflow-hidden rounded-2xl border border-white/12 shadow-lg">
        <GoogleMapClient {...mapProps} />
      </div>
    </div>
  );
}

export default memo(CustomerHomeMapPanel);

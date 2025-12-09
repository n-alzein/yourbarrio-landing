"use client";

import { useEffect, useRef, useState } from "react";

// Load Google Maps only once per page via a single script tag
async function loadGoogleMaps(apiKey, mapId) {
  if (typeof window === "undefined") throw new Error("No window");
  if (window.google && window.google.maps) return window.google;

  if (!window.__googleMapsLoaderPromise) {
    window.__googleMapsLoaderPromise = new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        key: apiKey,
        libraries: "marker",
        v: "weekly",
      });
      if (mapId) params.set("map_ids", mapId);

      // avoid duplicate tags; if an existing one lacks a key, replace it
      const existing = Array.from(document.scripts || []).find((s) => s.src && s.src.includes("maps.googleapis.com/maps/api/js"));
      if (existing) {
        if (existing.src.includes("key=")) {
          existing.addEventListener("load", () => resolve(window.google));
          existing.addEventListener("error", reject);
          return;
        }
        existing.remove();
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }

  return window.__googleMapsLoaderPromise;
}

// helper: compute distance in km
function haversine(lat1, lon1, lat2, lon2) {
  function toRad(x) {
    return (x * Math.PI) / 180;
  }
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const ALLOWED_RETAIL_TYPES = new Set([
  "florist",
  "bakery",
  "book_store",
  "clothing_store",
  "convenience_store",
  "department_store",
  "electronics_store",
  "furniture_store",
  "home_goods_store",
  "hardware_store",
  "jewelry_store",
  "liquor_store",
  "pet_store",
  "pharmacy",
  "shoe_store",
  "shopping_mall",
  "store",
  "supermarket",
  "bicycle_store",
  "cell_phone_store",
]);

const formatCategory = (type) => {
  if (!type) return "Uncategorized";
  const withSpaces = type.replace(/_/g, " ");
  return withSpaces
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const computeVisibleRadiusMeters = (mapInstance, fallbackMeters) => {
  if (!mapInstance || !mapInstance.getBounds || !mapInstance.getCenter) {
    return Math.max(100, fallbackMeters || 1000);
  }
  const bounds = mapInstance.getBounds();
  const center = mapInstance.getCenter();
  if (!bounds || !center) return Math.max(100, fallbackMeters || 1000);
  const ne = bounds.getNorthEast();
  const diagKm = haversine(center.lat(), center.lng(), ne.lat(), ne.lng());
  return Math.max(100, diagKm * 1000);
};

export default function GoogleMapClient({
  radiusKm = 25,
  containerClassName = "w-full max-w-6xl mx-auto mt-12",
  cardClassName = "bg-white/5 border border-white/10 rounded-2xl p-4 text-white",
  mapClassName = "h-80 rounded-lg overflow-hidden",
  title = "Businesses Near You",
  showBusinessErrors = true,
  enableCategoryFilter = false,
  enableSearch = false,
}) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mapInstanceRef = useRef(null);
  const businessMarkersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const searchMarkerRef = useRef(null);
  const mapIdRef = useRef(null);
  const lastFetchRef = useRef({ lat: null, lng: null, zoom: null });
  const fetchInFlightRef = useRef(false);
  const apiKeyRef = useRef(null);
  const loadAndPlaceMarkersRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesWithCounts, setCategoriesWithCounts] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");

  const detachMarker = (marker) => {
    if (!marker) return;
    if (typeof marker.setMap === "function") {
      marker.setMap(null);
    } else if ("map" in marker) {
      marker.map = null;
    }
  };

  const clearBusinessMarkers = () => {
    businessMarkersRef.current.forEach(detachMarker);
    businessMarkersRef.current = [];
  };

  const renderMarkers = (list, category) => {
    if (!mapInstanceRef.current) return;
    clearBusinessMarkers();

    const filtered =
      category === "All"
        ? list
        : list.filter((biz) => biz.categoryLabel === category);

    if (!filtered.length) return;

    const canUseAdvanced =
      mapIdRef.current && window.google?.maps?.marker?.AdvancedMarkerElement;

    filtered.forEach((biz) => {
      if (!biz.coords) return;

      const wrapper = document.createElement("div");
      wrapper.className = "yb-marker";
      const localWrap = document.createElement("div");
      localWrap.className = "yb-marker-local";
      const icon = document.createElement("div");
      icon.className = "yb-marker-icon";
      const label = document.createElement("div");
      label.className = "yb-marker-label";
      label.textContent = biz.name;
      localWrap.appendChild(icon);
      localWrap.appendChild(label);
      wrapper.appendChild(localWrap);

      if (canUseAdvanced) {
        const advMarker = new window.google.maps.marker.AdvancedMarkerElement({
          position: biz.coords,
          map: mapInstanceRef.current,
          title: biz.name,
          content: wrapper,
        });

        const info = new window.google.maps.InfoWindow({
          content: `<div style="color:#0f172a"><strong>${biz.name}</strong><div style="font-size:12px">${biz.categoryLabel}</div><div style="font-size:12px">${biz.address || ""}</div></div>`,
        });

        advMarker.addListener("click", () =>
          info.open({ anchor: advMarker, map: mapInstanceRef.current })
        );
        businessMarkersRef.current.push(advMarker);
      } else {
        const m = new window.google.maps.Marker({
          position: biz.coords,
          map: mapInstanceRef.current,
          title: biz.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#6b7280",
            fillOpacity: 1,
            strokeColor: "#f3f4f6",
            strokeWeight: 2,
          },
        });
        const info = new window.google.maps.InfoWindow({
          content: `<div style="color:#0f172a"><strong>${biz.name}</strong><div style="font-size:12px">${biz.categoryLabel}</div><div style="font-size:12px">${biz.address || ""}</div></div>`,
        });
        m.addListener("click", () => info.open(mapInstanceRef.current, m));
        m.addListener("mouseover", () => info.open(mapInstanceRef.current, m));
        m.addListener("mouseout", () => info.close());
        businessMarkersRef.current.push(m);
      }
    });
  };

  useEffect(() => {
    let map;
    let isMounted = true;
    let idleListener;

    async function init() {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
      if (!apiKey) {
        setError("Google Maps API key missing. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
        setLoading(false);
        return;
      }

      // Debug logs to help diagnose loader / API key issues
      try {
        console.debug("GoogleMapClient: apiKey present?", !!apiKey);
        console.debug("GoogleMapClient: window.google before load:", typeof window !== "undefined" ? window.google : "no-window");
        const scriptSrcs = Array.from(document.scripts || [])
          .map((s) => s.src)
          .filter((src) => src && src.includes("maps.googleapis.com"));
        console.debug("GoogleMapClient: existing maps script tags:", scriptSrcs);
      } catch (e) {
        console.warn("GoogleMapClient debug log failed", e);
      }

      try {
        const google = await loadGoogleMaps(apiKey, mapId);
        console.debug("GoogleMapClient: google after load:", google, "google.maps?", !!(google && google.maps));

        apiKeyRef.current = apiKey;

        mapIdRef.current = mapId;

        // Create map centered on a default location until we get user location
        map = new google.maps.Map(mapRef.current, {
          center: { lat: 37.7749, lng: -122.4194 },
          zoom: 13,
          disableDefaultUI: false,
          ...(mapId ? { mapId } : {}), // mapId enables Advanced Markers / vector maps
        });
        mapInstanceRef.current = map;

        // get user location (with graceful fallback)
        const defaultCenter = { lat: 37.7749, lng: -122.4194 };

        const placeUserMarker = (centerLat, centerLng) => {
          if (centerLat === defaultCenter.lat && centerLng === defaultCenter.lng) return;
          detachMarker(userMarkerRef.current);
          const userEl = document.createElement("div");
          userEl.className = "yb-user-marker";
          const canUseAdvanced = mapIdRef.current && window.google?.maps?.marker?.AdvancedMarkerElement;
          if (canUseAdvanced) {
            userMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
              position: { lat: centerLat, lng: centerLng },
              map,
              title: "You",
              content: userEl,
            });
          } else {
            userMarkerRef.current = new window.google.maps.Marker({
              position: { lat: centerLat, lng: centerLng },
              map,
              title: "You",
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#7c3aed",
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "white",
              },
            });
          }
        };

        const fetchPlacesNew = async ({ lat, lng, radiusMeters, includedTypes }) => {
          const apiKey = apiKeyRef.current;
          if (!apiKey) throw new Error("API key missing");
          const radius = radiusMeters ?? Math.max(100, radiusKm * 1000);
          const retailTypes = includedTypes && includedTypes.length
            ? includedTypes
            : Array.from(ALLOWED_RETAIL_TYPES).filter(
                (t) => t !== "grocery_or_supermarket" && t !== "cosmetics_store" && t !== "drugstore" && t !== "gift_shop" && t !== "butcher_shop" && t !== "market"
              );
          const body = {
            includedTypes: retailTypes,
            maxResultCount: 20,
            locationRestriction: {
              circle: {
                center: { latitude: lat, longitude: lng },
                radius,
              },
            },
          };
          const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask":
                "places.id,places.displayName.text,places.formattedAddress,places.location,places.types",
            },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Places (new) request failed: ${res.status} ${txt}`);
          }
          const data = await res.json();
          return data.places || [];
        };

        const shouldRefetch = (lat, lng, zoom) => {
          if (lastFetchRef.current.lat === null) return true;
          const dist = haversine(lat, lng, lastFetchRef.current.lat, lastFetchRef.current.lng);
          if (dist > 0.5) return true; // re-fetch if moved >500m
          if (zoom !== lastFetchRef.current.zoom) return true;
          return false;
        };

        async function loadAndPlaceMarkers(centerLat, centerLng, zoomLevel, radiusOverrideMeters, includedTypesOverride) {
          if (!isMounted) return;
          if (fetchInFlightRef.current) return;

          placeUserMarker(centerLat, centerLng);
          clearBusinessMarkers();
          setBusinesses([]);
          setLoading(true);
          fetchInFlightRef.current = true;
          lastFetchRef.current = {
            lat: centerLat,
            lng: centerLng,
            zoom: zoomLevel ?? map?.getZoom?.(),
          };

          const bounds = map?.getBounds ? map.getBounds() : null;
          const radiusMeters = radiusOverrideMeters || computeVisibleRadiusMeters(map, radiusKm * 1000);

          let places = [];
          try {
            places = await fetchPlacesNew({ lat: centerLat, lng: centerLng, radiusMeters, includedTypes: includedTypesOverride });
          } catch (errNew) {
            console.error("Places (new) fetch failed", errNew);
            if (showBusinessErrors) {
              setError(
                "Google Places request was denied. Check API key referrer restrictions and ensure Places API (New) is enabled."
              );
            }
            setLoading(false);
            fetchInFlightRef.current = false;
            setBusinesses([]);
            return;
          }

          const businessesWithCoords = [];
          for (const place of places || []) {
            // map both legacy and new payloads
            const loc =
              place.geometry?.location ||
              (place.location
                ? {
                    lat: () => place.location.latitude,
                    lng: () => place.location.longitude,
                  }
                : null);
            if (!loc) continue;
            const pts = { lat: typeof loc.lat === "function" ? loc.lat() : loc.lat, lng: typeof loc.lng === "function" ? loc.lng() : loc.lng };
            if (bounds && !bounds.contains(new google.maps.LatLng(pts.lat, pts.lng))) {
              continue;
            }
            const typeList = place.types || [];
            const primaryType = typeList.find((t) => t && ALLOWED_RETAIL_TYPES.has(t));
            if (!primaryType) continue; // skip non-retail/service entries
            const categoryKey = primaryType || "store";
            const categoryLabel = formatCategory(categoryKey);
            businessesWithCoords.push({
              id: place.place_id || place.id,
              name: place.name || place.displayName?.text || "Unnamed",
              address: place.vicinity || place.formatted_address || place.formattedAddress || "",
              coords: pts,
              categoryLabel,
              source: "google_places_new",
              zoom: zoomLevel || map?.getZoom?.(),
            });
          }

          if (!isMounted) return;

          const categoryCounts = businessesWithCoords.reduce((acc, biz) => {
            acc[biz.categoryLabel] = (acc[biz.categoryLabel] || 0) + 1;
            return acc;
          }, {});
          const uniqueCategories = Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b));
          const categoriesList = uniqueCategories.map((cat) => ({
            name: cat,
            count: categoryCounts[cat] || 0,
          }));
          setBusinesses(businessesWithCoords);
          setCategories(uniqueCategories);
          setCategoriesWithCounts(categoriesList);
          renderMarkers(businessesWithCoords, activeCategory);
          setLoading(false);
          fetchInFlightRef.current = false;
        }

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const userLat = pos.coords.latitude;
              const userLng = pos.coords.longitude;
              map.setCenter({ lat: userLat, lng: userLng });
              loadAndPlaceMarkers(userLat, userLng, map.getZoom(), computeVisibleRadiusMeters(map, radiusKm * 1000));
            },
            (err) => {
              console.warn("Geolocation error", err);
              setError("Could not get your location. Showing nearby businesses around a default location.");
              map.setCenter(defaultCenter);
              loadAndPlaceMarkers(defaultCenter.lat, defaultCenter.lng, map.getZoom(), computeVisibleRadiusMeters(map, radiusKm * 1000));
            },
            { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5 }
          );
        } else {
          setError("Geolocation not supported. Showing default area.");
          map.setCenter(defaultCenter);
          loadAndPlaceMarkers(defaultCenter.lat, defaultCenter.lng, map.getZoom(), computeVisibleRadiusMeters(map, radiusKm * 1000));
        }

        let idleTimeout;
        idleListener = map.addListener("idle", () => {
          if (idleTimeout) clearTimeout(idleTimeout);
          idleTimeout = setTimeout(() => {
            const center = map.getCenter();
            if (!center) return;
            const lat = center.lat();
            const lng = center.lng();
            const zoom = map.getZoom();
            if (!shouldRefetch(lat, lng, zoom)) return;
            loadAndPlaceMarkers(lat, lng, zoom, computeVisibleRadiusMeters(map, radiusKm * 1000));
          }, 450);
        });

        // expose reload for search
        loadAndPlaceMarkersRef.current = (lat, lng, zoom, radiusMeters, includedTypes) => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter({ lat, lng });
          }
          return typeof lat === "number" && typeof lng === "number"
            ? loadAndPlaceMarkers(lat, lng, zoom, radiusMeters, includedTypes)
            : null;
        };
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load map");
        setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
      clearBusinessMarkers();
      detachMarker(userMarkerRef.current);
      if (idleListener) idleListener.remove();
      fetchInFlightRef.current = false;
      loadAndPlaceMarkersRef.current = null;
    };
  }, [radiusKm]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    renderMarkers(businesses, activeCategory);
  }, [activeCategory, businesses]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim() || !mapInstanceRef.current) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchMessage(null);
    detachMarker(searchMarkerRef.current);
    try {
      const apiKey = apiKeyRef.current;
      if (!apiKey) throw new Error("API key missing");
      const map = mapInstanceRef.current;
      const center = map.getCenter();
      const radiusMeters = computeVisibleRadiusMeters(map, radiusKm * 1000);
      const searchTypeKey = searchTerm.trim().toLowerCase().replace(/\s+/g, "_");
      const limitedTypes =
        ALLOWED_RETAIL_TYPES.has(searchTypeKey) ? [searchTypeKey] : undefined;

      const body = {
        textQuery: searchTerm.trim(),
        maxResultCount: 5,
        locationBias: {
          circle: {
            center: { latitude: center?.lat?.(), longitude: center?.lng?.() },
            radius: radiusMeters,
          },
        },
      };

      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName.text,places.formattedAddress,places.location,places.types",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Search failed: ${res.status} ${txt}`);
      }
      const data = await res.json();
      const place = data.places?.[0];
      if (!place?.location) {
        setSearchMessage("No matching place found nearby.");
        setSearchLoading(false);
        return;
      }

      const { latitude, longitude } = place.location;
      const target = { lat: latitude, lng: longitude };
      map.panTo(target);
      map.setZoom(Math.max(map.getZoom(), 15));

      // drop a temporary search marker
      const canUseAdvanced = mapIdRef.current && window.google?.maps?.marker?.AdvancedMarkerElement;
      const markerContent = document.createElement("div");
      markerContent.className = "yb-marker";
      const inner = document.createElement("div");
      inner.className = "yb-marker-local";
      const icon = document.createElement("div");
      icon.className = "yb-marker-icon";
      const label = document.createElement("div");
      label.className = "yb-marker-label";
      label.textContent = place.displayName?.text || "Selected";
      inner.appendChild(icon);
      inner.appendChild(label);
      markerContent.appendChild(inner);

      detachMarker(searchMarkerRef.current);
      if (canUseAdvanced) {
        searchMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
          position: target,
          map,
          title: place.displayName?.text || "Selected",
          content: markerContent,
        });
      } else {
        searchMarkerRef.current = new window.google.maps.Marker({
          position: target,
          map,
          title: place.displayName?.text || "Selected",
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#6b7280",
            fillOpacity: 1,
            strokeColor: "#f3f4f6",
            strokeWeight: 2,
          },
        });
      }

      await loadAndPlaceMarkersRef.current?.(
        latitude,
        longitude,
        map.getZoom(),
        computeVisibleRadiusMeters(map, radiusKm * 1000),
        limitedTypes
      );
      if (limitedTypes?.length) {
        const label = formatCategory(limitedTypes[0]);
        setActiveCategory(label);
      }
      setSearchMessage(place.displayName?.text || "Moved to result");
    } catch (err) {
      console.error(err);
      setSearchError(err.message || "Search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div ref={containerRef} className={containerClassName}>
      <div className={cardClassName}>
        {title ? <div className="mb-3 font-medium">{title}</div> : null}
        {enableSearch ? (
          <form onSubmit={handleSearch} className="mb-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search nearby places"
                className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-white/50"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-60"
                disabled={searchLoading || !searchTerm.trim()}
              >
                {searchLoading ? "Searching..." : "Search"}
              </button>
            </div>
            {searchError ? <div className="text-xs text-rose-200">{searchError}</div> : null}
            {searchMessage ? <div className="text-xs text-emerald-200">{searchMessage}</div> : null}
          </form>
        ) : null}
        {error ? (
          <div className="mb-3 text-sm text-amber-200/90 bg-amber-500/15 border border-amber-300/30 rounded-xl px-3 py-2">
            {error}
          </div>
        ) : null}
        {enableCategoryFilter ? (
          <div className="mb-3 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">
              Filter by category
            </div>
            <div className="flex flex-wrap gap-2">
              {["All", ...categories].map((cat) => {
                const count = categoriesWithCounts.find((c) => c.name === cat)?.count;
                const label =
                  cat === "All" && businesses.length
                    ? `All (${businesses.length})`
                    : count
                      ? `${cat} (${count})`
                      : cat;

                return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-full border text-xs transition ${
                    activeCategory === cat
                      ? "bg-white text-black border-white"
                      : "bg-white/5 border-white/20 text-white/80 hover:border-white/40"
                  }`}
                  aria-pressed={activeCategory === cat}
                  disabled={loading || businesses.length === 0}
                >
                  {label}
                </button>
                );
              })}
            </div>
            {!loading && !error && businesses.length === 0 ? (
              <div className="text-xs text-white/60">
                No businesses found in this area yet. Icons will appear as data comes in.
              </div>
            ) : null}
          </div>
        ) : null}
        <div className={mapClassName} ref={mapRef} id="google-map" />
        {loading && <div className="mt-2 text-sm text-white/70">Loading map...</div>}
        {error && <div className="mt-2 text-sm text-rose-400">{error}</div>}
      </div>
    </div>
  );
}

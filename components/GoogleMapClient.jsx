"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

// Load Google Maps only once per page via a single script tag
async function loadGoogleMaps(apiKey, mapId) {
  if (typeof window === "undefined") throw new Error("No window");
  if (window.google && window.google.maps && window.google.maps.Geocoder) return window.google;

  if (!window.__googleMapsLoaderPromise) {
    window.__googleMapsLoaderPromise = new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        key: apiKey,
        libraries: "places,marker",
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
      script.onload = () => {
        // ensure Geocoder is available before resolving
        const ready = () => window.google && window.google.maps && window.google.maps.Geocoder;
        if (ready()) {
          resolve(window.google);
        } else {
          // wait briefly for the API to finish bootstrapping
          setTimeout(() => resolve(window.google), 100);
        }
      };
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }

  return window.__googleMapsLoaderPromise;
}

export default function GoogleMapClient({
  radiusKm = 25,
  containerClassName = "w-full max-w-6xl mx-auto mt-12",
  cardClassName = "bg-white/5 border border-white/10 rounded-2xl p-4 text-white",
  mapClassName = "h-80 rounded-lg overflow-hidden",
  title = "Businesses Near You",
  showBusinessErrors = true,
}) {
  const { supabase } = useAuth();
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let map;
    let markers = [];
    let geocoder;

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
        console.debug("GoogleMapClient: google after load:", google, "google.maps.Geocoder?", !!(google && google.maps && google.maps.Geocoder));

        if (!(window.google && window.google.maps && window.google.maps.Geocoder)) {
          console.error("GoogleMapClient: google.maps.Geocoder is not available.");
          setError("Google Maps did not load required libraries (Geocoder missing). Check API key and enabled APIs.");
          setLoading(false);
          return;
        }

        geocoder = new window.google.maps.Geocoder();

        // Create map centered on a default location until we get user location
        map = new google.maps.Map(mapRef.current, {
          center: { lat: 37.7749, lng: -122.4194 },
          zoom: 13,
          disableDefaultUI: false,
          ...(mapId ? { mapId } : {}), // mapId enables Advanced Markers / vector maps
        });

        // get user location (with graceful fallback)
        const defaultCenter = { lat: 37.7749, lng: -122.4194 };

        async function loadAndPlaceMarkers(centerLat, centerLng) {
          // show user marker if center is actual user coords (not default)
          if (centerLat !== defaultCenter.lat || centerLng !== defaultCenter.lng) {
            const userEl = document.createElement("div");
            userEl.className = "yb-user-marker";
            const canUseAdvanced = mapId && window.google?.maps?.marker?.AdvancedMarkerElement;
            if (canUseAdvanced) {
              const userMarker = new window.google.maps.marker.AdvancedMarkerElement({
                position: { lat: centerLat, lng: centerLng },
                map,
                title: "You",
                content: userEl,
              });
              markers.push(userMarker);
            } else {
              // Classic marker when no mapId / Advanced Marker support
              const m = new window.google.maps.Marker({
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
              markers.push(m);
            }
          }

          const { data: businesses, error: bErr } = await supabase
            .from("businesses")
            .select("id, name, address, latitude, longitude, category")
            .limit(200);

              if (bErr) {
                try {
                  console.error("Supabase error fetching businesses:", JSON.stringify(bErr, null, 2));
                } catch (e) {
                  console.error("Supabase error fetching businesses:", bErr);
                }
                if (showBusinessErrors) {
                  setError("Failed to load businesses (see console)");
                }
                setLoading(false);
                return;
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

          // For businesses without lat/lng, geocode their address (serially, small number)
          const geocodeCache = {};

          async function ensureLatLng(biz) {
            if (biz.latitude && biz.longitude) return { lat: biz.latitude, lng: biz.longitude };
            if (!biz.address) return null;
            if (geocodeCache[biz.address]) return geocodeCache[biz.address];
            try {
              const res = await geocoder.geocode({ address: biz.address });
              if (res.status === "OK" && res.results[0]) {
                const loc = res.results[0].geometry.location;
                const pts = { lat: loc.lat(), lng: loc.lng() };
                geocodeCache[biz.address] = pts;
                return pts;
              }
            } catch (e) {
              console.warn("Geocode failed", e);
            }
            return null;
          }

          // Add markers for businesses within radius
          for (const biz of businesses || []) {
            const pts = await ensureLatLng(biz);
            if (!pts) continue;
            const dist = haversine(centerLat, centerLng, pts.lat, pts.lng);
            if (dist > radiusKm) continue;

                // Use AdvancedMarkerElement when mapId is present; otherwise classic Marker
                const content = document.createElement("div");
                content.className = "yb-marker";
                content.innerHTML = `<div class="yb-marker-inner">${biz.name}</div>`;

                const canUseAdvanced = mapId && window.google?.maps?.marker?.AdvancedMarkerElement;

                if (canUseAdvanced) {
                  const advMarker = new window.google.maps.marker.AdvancedMarkerElement({
                    position: pts,
                    map,
                    title: biz.name,
                    content,
                  });

                  const info = new window.google.maps.InfoWindow({
                    content: `<div style="color:#000"><strong>${biz.name}</strong><div style="font-size:12px">${biz.category || ""}</div><div style="font-size:12px">${biz.address || ""}</div></div>`,
                  });

                  advMarker.addEventListener("click", () => info.open({ anchor: advMarker, map }));
                  markers.push(advMarker);
                } else {
                  const m = new window.google.maps.Marker({
                    position: pts,
                    map,
                    title: biz.name,
                  });
                  const info = new window.google.maps.InfoWindow({
                    content: `<div style="color:#000"><strong>${biz.name}</strong><div style="font-size:12px">${biz.category || ""}</div><div style="font-size:12px">${biz.address || ""}</div></div>`,
                  });
                  m.addListener("click", () => info.open(map, m));
                  markers.push(m);
                }
          }

          setLoading(false);
        }

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const userLat = pos.coords.latitude;
              const userLng = pos.coords.longitude;
              map.setCenter({ lat: userLat, lng: userLng });
              loadAndPlaceMarkers(userLat, userLng);
            },
            (err) => {
              console.warn("Geolocation error", err);
              setError("Could not get your location. Showing nearby businesses around a default location.");
              map.setCenter(defaultCenter);
              loadAndPlaceMarkers(defaultCenter.lat, defaultCenter.lng);
            },
            { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5 }
          );
        } else {
          setError("Geolocation not supported. Showing default area.");
          map.setCenter(defaultCenter);
          loadAndPlaceMarkers(defaultCenter.lat, defaultCenter.lng);
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load map");
        setLoading(false);
      }
    }

    init();

    return () => {
      // cleanup markers
      if (markers && markers.length) {
        markers.forEach((m) => m.setMap(null));
      }
    };
  }, [supabase, radiusKm]);

  return (
    <div ref={containerRef} className={containerClassName}>
      <div className={cardClassName}>
        {title ? <div className="mb-3 font-medium">{title}</div> : null}
        <div className={mapClassName} ref={mapRef} id="google-map" />
        {loading && <div className="mt-2 text-sm text-white/70">Loading map...</div>}
        {error && <div className="mt-2 text-sm text-rose-400">{error}</div>}
      </div>
    </div>
  );
}

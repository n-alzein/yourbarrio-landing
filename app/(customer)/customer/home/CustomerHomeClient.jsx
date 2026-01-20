"use client";
/*
  HOME_BISECT FLAGS (toggle to isolate blockers on /customer/home):
    NEXT_PUBLIC_HOME_BISECT_MAP (default 1)
    NEXT_PUBLIC_HOME_BISECT_HOME_AUDIT (default 1)
    NEXT_PUBLIC_HOME_BISECT_PD_TRACER (default 1)
    NEXT_PUBLIC_HOME_BISECT_SAFE_NAV (default 0)
    NEXT_PUBLIC_HOME_BISECT_TILE_DIAG (default 1)
  Protocol: build prod, toggle one flag to 0 (or SAFE_NAV to 1), rebuild, and observe whether anchor clicks still get defaultPrevented. If a flag fixes it, the associated module is the culprit.
*/

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import React from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import dynamic from "next/dynamic";
import { primaryPhotoUrl } from "@/lib/listingPhotos";
import SafeImage from "@/components/SafeImage";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getAvailabilityBadgeStyle,
  normalizeInventory,
  sortListingsByAvailability,
} from "@/lib/inventory";
import { installPreventDefaultTracer } from "@/lib/tracePreventDefault";
import { installHomeNavInstrumentation } from "@/lib/navInstrumentation";
import { appendCrashLog } from "@/lib/crashlog";
import MapModal from "@/components/customer/MapModal";
import { BUSINESS_CATEGORIES } from "@/lib/businessCategories";
import { useGridVirtualRows } from "@/components/home/useGridVirtualRows";
import { logDataDiag } from "@/lib/dataDiagnostics";

const SAMPLE_BUSINESSES = [
  {
    id: "sample-1",
    name: "Barrio Cafe",
    category: "Cafe",
    categoryLabel: "Cafe",
    address: "123 Sample St, San Francisco",
    description: "Neighborhood coffee and light bites.",
    website: "",
    imageUrl: "",
    source: "sample",
    coords: { lat: 37.7749, lng: -122.4194 },
  },
  {
    id: "sample-2",
    name: "Barrio Market",
    category: "Market",
    categoryLabel: "Market",
    address: "456 Grove Ave, San Francisco",
    description: "Local grocery staples and fresh produce.",
    website: "",
    imageUrl: "",
    source: "sample",
    coords: { lat: 37.779, lng: -122.423 },
  },
];

const isSameBusinessList = (prev, next) => {
  if (!Array.isArray(prev) || !Array.isArray(next)) return false;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i]?.id !== next[i]?.id) return false;
  }
  return true;
};
const HomeGuard = dynamic(() => import("@/components/debug/HomeGuard"), { ssr: false });
function HomeGuardFallback() {
  const { theme, hydrated } = useTheme();
  const isLight = hydrated ? theme === "light" : true;
  const textBase = isLight ? "text-slate-900" : "text-white";
  const textMuted = isLight ? "text-slate-600" : "text-white/70";

  return (
    <div className={`min-h-screen ${textBase} relative px-6 pt-3`}>
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
        <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
      </div>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 rounded-full border-4 border-white/10 border-t-white/70 animate-spin mx-auto" />
          <p className={`text-lg ${textMuted}`}>Loading your account...</p>
        </div>
      </div>
    </div>
  );
}
const SafeNavFallback = dynamic(() => import("@/components/nav/SafeNavFallback"), { ssr: false });
import GuaranteedNavCapture from "@/components/nav/GuaranteedNavCapture";

class CustomerHomeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Something went wrong." };
  }

  componentDidCatch(error, info) {
    console.error("Customer home crashed", error, info);
    appendCrashLog({
      type: "react-error",
      message: error?.message,
      stack: error?.stack,
      info: info?.componentStack,
      route: "/customer/home",
    });
  }

  render() {
    if (this.state.hasError) {
      const isLight = this.props.isLight ?? true;
      const textBase = isLight ? "text-slate-900" : "text-white";
      const textMuted = isLight ? "text-slate-600" : "text-white/70";
      return (
        <div className={`min-h-screen flex items-center justify-center px-6 ${textBase}`}>
          <div className="max-w-md w-full space-y-4 text-center bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className={`text-sm ${textMuted}`}>
              {this.state.message || "The page failed to load. Please try again."}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: "" });
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="w-full py-3 rounded-xl font-semibold bg-white text-black hover:bg-white/90 transition"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function CustomerHomePageInner({ initialListings: initialListingsProp }) {
  const searchParams = useSearchParams();
  const { user, loadingUser, supabase } = useAuth();
  const { theme, hydrated } = useTheme();
  const isLight = hydrated ? theme === "light" : true;
  const VIRTUALIZE = process.env.NEXT_PUBLIC_HOME_VIRTUALIZE === "1";
  const textTone = useMemo(
    () => ({
      base: isLight ? "text-slate-900" : "text-white",
      strong: isLight ? "text-slate-900" : "text-white/90",
      muted: isLight ? "text-slate-700" : "text-white/80",
      soft: isLight ? "text-slate-600" : "text-white/70",
      subtle: isLight ? "text-slate-500" : "text-white/60",
      faint: isLight ? "text-slate-400" : "text-white/50",
      tint: isLight ? "text-slate-700" : "text-white/75",
    }),
    [isLight]
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [mapOpen, setMapOpen] = useState(false);
  // DEBUG_CLICK_DIAG
  const clickDiagEnabled = process.env.NEXT_PUBLIC_CLICK_DIAG === "1";
  const homeBisect = {
    map: process.env.NEXT_PUBLIC_HOME_BISECT_MAP !== "0",
    homeAudit: process.env.NEXT_PUBLIC_HOME_BISECT_HOME_AUDIT !== "0",
    pdTracer: process.env.NEXT_PUBLIC_HOME_BISECT_PD_TRACER !== "0",
    safeNav: process.env.NEXT_PUBLIC_HOME_BISECT_SAFE_NAV === "1",
    tileDiag: process.env.NEXT_PUBLIC_HOME_BISECT_TILE_DIAG !== "0",
  };
  const mapEnabled = homeBisect.map;
  const mapAvailable = mapEnabled && process.env.NEXT_PUBLIC_DISABLE_MAP !== "1";
  const initialYb = (() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = sessionStorage.getItem("yb_customer_home_businesses");
      const parsed = cached ? JSON.parse(cached) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const initialListingsFromStorage = (() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = sessionStorage.getItem("yb_customer_home_listings");
      const parsed = cached ? JSON.parse(cached) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const hasInitialListings = Array.isArray(initialListingsProp);
  const resolvedInitialListings = hasInitialListings
    ? initialListingsProp
    : initialListingsFromStorage;
  const [mapBusinesses, setMapBusinesses] = useState(initialYb);
  const [hybridItems, setHybridItems] = useState([]);
  const [hybridItemsLoading, setHybridItemsLoading] = useState(false);
  const [hybridItemsError, setHybridItemsError] = useState(null);
  const [allListings, setAllListings] = useState(resolvedInitialListings);
  const [allListingsLoading, setAllListingsLoading] = useState(
    !hasInitialListings && resolvedInitialListings.length === 0
  );
  const [hasLoadedListings, setHasLoadedListings] = useState(
    hasInitialListings || resolvedInitialListings.length > 0
  );
  const [ybBusinesses, setYbBusinesses] = useState(initialYb);
  const [ybBusinessesLoading, setYbBusinessesLoading] = useState(
    initialYb.length === 0
  );
  const [hasLoadedYb, setHasLoadedYb] = useState(initialYb.length > 0);
  const hasLoadedYbRef = useRef(hasLoadedYb);
  const [ybBusinessesError, setYbBusinessesError] = useState(null);
  const [isVisible, setIsVisible] = useState(() =>
    typeof document === "undefined" ? true : !document.hidden
  );
  const ybFetchedRef = useRef(false);
  const allListingsFetchedRef = useRef(false);
  const ybRequestIdRef = useRef(0);
  const allListingsRequestIdRef = useRef(0);
  const hybridRequestIdRef = useRef(0);
  const authReady = !loadingUser || !!user;
  const galleryRef = useRef(null);
  const gridContainerRef = useRef(null);
  const [gridColumns, setGridColumns] = useState(() => {
    if (typeof window === "undefined") return 4;
    const width = window.innerWidth;
    if (width >= 1280) return 6;
    if (width >= 1024) return 5;
    if (width >= 768) return 4;
    if (width >= 640) return 3;
    return 2;
  });
  const [rowHeight, setRowHeight] = useState(360);
  const [rowGap, setRowGap] = useState(12);
  const [supportsContentVisibility, setSupportsContentVisibility] = useState(false);
  const tileDragState = useRef({
    pointerId: null,
    pointerType: null,
    startX: 0,
    startY: 0,
    dragging: false,
    lastDragAt: 0,
  });
  const logCrashEvent = useCallback(
    (payload) =>
      appendCrashLog({
        type: "customer-home",
        ...payload,
      }),
    []
  );

  useEffect(() => {
    hasLoadedYbRef.current = hasLoadedYb;
  }, [hasLoadedYb]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_HOME_GRID_DIAG !== "1") return undefined;
    // DEV-ONLY: track unexpected remounts while scrolling.
    console.log("[HOME_GRID_DIAG] grid mounted");
    return () => {
      console.log("[HOME_GRID_DIAG] grid unmounted");
    };
  }, []);

  useEffect(() => {
    const diagEnabled =
      process.env.NEXT_PUBLIC_HOME_GRID_DIAG === "1" ||
      process.env.NODE_ENV !== "production";
    if (!diagEnabled) return;
    console.log("[HOME_GRID_DIAG] initial listings", {
      type: typeof initialListingsProp,
      isArray: Array.isArray(initialListingsProp),
      length: initialListingsProp?.length ?? null,
    });
    console.log("[HOME_GRID_DIAG] state listings", {
      length: allListings.length,
    });
  }, [initialListingsProp, allListings.length]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!clickDiagEnabled || !homeBisect.pdTracer) return undefined;
    const cleanup = installPreventDefaultTracer();
    return cleanup;
  }, [clickDiagEnabled, homeBisect.pdTracer]);

  useEffect(() => {
    if (!clickDiagEnabled) return undefined;
    installHomeNavInstrumentation({ enabled: true });
    return undefined;
  }, [clickDiagEnabled]);

  useEffect(() => {
    if (!clickDiagEnabled) return undefined;
    const timer = setTimeout(() => {
      const shell = document.querySelector(".home-map-shell");
      if (!shell) return;
      const viewport = document.querySelector(".home-map-viewport");
      const nav = document.querySelector("nav.fixed") || document.querySelector("nav");
      const tiles = document.querySelector('[data-home-tiles="1"]');
      const overlaps = (a, b) => {
        if (!a || !b) return false;
        return !(
          a.right <= b.left ||
          a.left >= b.right ||
          a.bottom <= b.top ||
          a.top >= b.bottom
        );
      };
      const shellRect = shell.getBoundingClientRect();
      const viewportRect = viewport?.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      const tilesRect = tiles?.getBoundingClientRect();
      const styles = [];
      let node = shell;
      for (let i = 0; i < 4 && node; i += 1) {
        const cs = window.getComputedStyle(node);
        styles.push({
          tag: node.tagName?.toLowerCase() || "unknown",
          className: (node.className || "").toString(),
          position: cs.position,
          zIndex: cs.zIndex,
          pointerEvents: cs.pointerEvents,
          opacity: cs.opacity,
          transform: cs.transform,
          filter: cs.filter,
          isolation: cs.isolation,
          contain: cs.contain,
        });
        node = node.parentElement;
      }

      console.log("[HOME_MAP_ASSERT]", {
        shellRect,
        viewportRect,
        navRect,
        tilesRect,
        styles,
      });

      if (navRect && shellRect.top < navRect.bottom) {
        console.warn("[HOME_MAP_ASSERT] map overlaps navbar region", { shellRect, navRect });
      }
      if (tilesRect && overlaps(shellRect, tilesRect)) {
        console.warn("[HOME_MAP_ASSERT] map overlaps tiles container", { shellRect, tilesRect });
      }
      if (
        viewportRect &&
        (viewportRect.width > shellRect.width + 1 || viewportRect.height > shellRect.height + 1)
      ) {
        console.warn("[HOME_MAP_ASSERT] viewport exceeds shell bounds", {
          shellRect,
          viewportRect,
        });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [clickDiagEnabled]);

  useEffect(() => {
    if (!clickDiagEnabled || !homeBisect.homeAudit) return undefined;
    const stringifyNode = (node) => {
      if (!node) return "null";
      if (node === document) return "document";
      if (node === window) return "window";
      if (!node.tagName) return node.nodeName || "unknown";
      const tag = node.tagName.toLowerCase();
      const cls = (node.className || "").toString().trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
      return `${tag}${cls ? `.${cls}` : ""}`;
    };
    const audit = (event) => {
      try {
        const { clientX = 0, clientY = 0 } = event;
        const top = document.elementFromPoint(clientX, clientY);
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        const anchor = event.target?.closest?.("a[href]");
        console.log("[CLICK_DIAG] HOME_AUDIT", {
          type: event.type,
          phase: "capture",
          defaultPrevented: event.defaultPrevented,
          cancelBubble: event.cancelBubble,
          target: stringifyNode(event.target),
          top: stringifyNode(top),
          anchor: anchor?.getAttribute?.("href") || null,
          path: path.slice(0, 6).map(stringifyNode),
        });
      } catch {
        /* ignore */
      }
    };
    const anchorPrevented = (event) => {
      const a = event.target?.closest?.("a[href]");
      if (!a) return;
      queueMicrotask(() => {
        if (event.defaultPrevented) {
          console.warn("[ANCHOR_PREVENTED]", {
            href: a.getAttribute?.("href"),
            stack: new Error().stack,
          });
        }
      });
    };
    document.addEventListener("click", audit, { capture: true, passive: true });
    document.addEventListener("pointerdown", audit, { capture: true, passive: true });
    document.addEventListener("click", anchorPrevented, { capture: true, passive: true });
    return () => {
      document.removeEventListener("click", audit, { capture: true, passive: true });
      document.removeEventListener("pointerdown", audit, { capture: true, passive: true });
      document.removeEventListener("click", anchorPrevented, { capture: true, passive: true });
    };
  }, [clickDiagEnabled, homeBisect.homeAudit]);
  useEffect(() => {
    if (!clickDiagEnabled || !homeBisect.pdTracer) return undefined;
    const cleanup = installPreventDefaultTracer();
    return cleanup;
  }, [clickDiagEnabled, homeBisect.pdTracer]);
  const handleHomeCapture = (event) => {
    if (!clickDiagEnabled || !homeBisect.tileDiag) return;
    console.log("[CLICK_DIAG] home grid capture", {
      target: event.target,
      currentTarget: event.currentTarget,
    });
  };
  const diagTileClick =
    (label, tileId) =>
      (event) => {
        if (!clickDiagEnabled || !homeBisect.tileDiag) return;
        console.log(`[CLICK_DIAG] ${label}`, {
          tileId,
          defaultPrevented: event.defaultPrevented,
          target: event.target?.tagName,
          currentTarget: event.currentTarget?.tagName,
        });
        const hrefAttr = event.currentTarget?.getAttribute?.("href");
        if (hrefAttr) {
          console.log("[CLICK_DIAG] TILE_HREF", { tileId, href: hrefAttr });
        }
        queueMicrotask(() => {
          console.log("[CLICK_DIAG] TILE_POST", { tileId, href: window.location.href });
        });
      };
  const coverFor = (value) => primaryPhotoUrl(value) || null;
  const businessPhotoFor = (biz) =>
    primaryPhotoUrl(
      biz?.imageUrl ||
        biz?.profile_photo_url ||
        biz?.photo_url ||
        biz?.image_url ||
        biz?.avatar_url ||
        biz?.logo_url
    ) || null;
  const filteredBusinesses = useMemo(() => {
    const source = ybBusinesses.length ? ybBusinesses : mapBusinesses;
    const q = search.trim().toLowerCase();
    const categoryFilterNormalized = categoryFilter.trim().toLowerCase();
    if (!q) {
      if (!categoryFilterNormalized || categoryFilterNormalized === "all") return source;
      return source.filter((biz) => {
        const categoryValue =
          biz.categoryLabel?.toLowerCase() ||
          biz.category?.toLowerCase() ||
          "";
        return categoryValue === categoryFilterNormalized;
      });
    }
    return source.filter((biz) => {
      const name = biz.name?.toLowerCase() || "";
      const category =
        biz.categoryLabel?.toLowerCase() ||
        biz.category?.toLowerCase() ||
        "";
      const desc = biz.description?.toLowerCase() || "";
      const matchesCategory =
        !categoryFilterNormalized ||
        categoryFilterNormalized === "all" ||
        category === categoryFilterNormalized;
      return (
        matchesCategory &&
        (name.includes(q) || category.includes(q) || desc.includes(q))
      );
    });
  }, [mapBusinesses, search, ybBusinesses, categoryFilter]);

  const scrollGallery = (dir) => {
    const el = galleryRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };
  const DRAG_DISTANCE_PX = 10;
  const DRAG_CANCEL_WINDOW_MS = 300;
  const handleTilePointerDown = useCallback((event) => {
    if (event.pointerType !== "touch") return;
    const state = tileDragState.current;
    state.pointerId = event.pointerId;
    state.pointerType = event.pointerType;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.dragging = false;
    state.lastDragAt = 0;
  }, []);
  const handleTilePointerMove = useCallback((event) => {
    const state = tileDragState.current;
    if (state.pointerType !== "touch" || state.pointerId !== event.pointerId) return;
    const dx = Math.abs(event.clientX - state.startX);
    const dy = Math.abs(event.clientY - state.startY);
    if (!state.dragging && (dx > DRAG_DISTANCE_PX || dy > DRAG_DISTANCE_PX)) {
      state.dragging = true;
    }
  }, []);
  const handleTilePointerUp = useCallback((event) => {
    const state = tileDragState.current;
    if (state.pointerType !== "touch" || state.pointerId !== event.pointerId) return;
    if (state.dragging) {
      state.lastDragAt = Date.now();
    }
    state.pointerId = null;
    state.pointerType = null;
    state.dragging = false;
  }, []);
  const handleTilePointerCancel = useCallback((event) => {
    const state = tileDragState.current;
    if (state.pointerType !== "touch" || state.pointerId !== event.pointerId) return;
    if (state.dragging) {
      state.lastDragAt = Date.now();
    }
    state.pointerId = null;
    state.pointerType = null;
    state.dragging = false;
  }, []);
  const handleTileClickCapture = useCallback((event) => {
    const { lastDragAt } = tileDragState.current;
    if (lastDragAt && Date.now() - lastDragAt < DRAG_CANCEL_WINDOW_MS) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  useEffect(() => {
    if (!isVisible && ybFetchedRef.current) return undefined;
    let active = true;
    const loadYb = async () => {
      const requestId = ++ybRequestIdRef.current;
      ybFetchedRef.current = true;
      setYbBusinessesLoading((prev) => (hasLoadedYbRef.current ? prev : true));
      setYbBusinessesError(null);
      logDataDiag("request:start", { label: "home:yb-businesses", requestId });
      const client = supabase ?? getSupabaseBrowserClient();
      try {
        let rows = [];

        // Try server-fed public endpoint first (uses service role when available)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(new DOMException("Timeout", "AbortError")),
            12000
          );
          const res = await fetch("/api/public-businesses", { signal: controller.signal });
          clearTimeout(timeoutId);
          const payload = await res.json().catch(() => ({}));
          if (res.ok && Array.isArray(payload?.businesses)) {
            rows = payload.businesses;
          }
        } catch (errApi) {
          if (errApi?.name === "AbortError") {
            logCrashEvent({
              context: "public-businesses",
              kind: "timeout",
              message: "/api/public-businesses timed out after 12s",
            });
            if (active && requestId === ybRequestIdRef.current) {
              setYbBusinesses(sampleBusinesses);
              setHasLoadedYb(true);
              setYbBusinessesError("Still loading businesses. Please refresh to retry.");
              setYbBusinessesLoading(false);
            }
            return;
          }
          console.warn("public-businesses endpoint failed", errApi);
        }

        // Fallback to direct Supabase query with anon key if endpoint returned nothing
        if (!rows.length && client) {
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(new DOMException("Timeout", "AbortError")),
            12000
          );
          try {
            let query = client
              .from("users")
              .select(
                "id,business_name,full_name,category,city,address,description,website,profile_photo_url,latitude,longitude,lat,lng,role"
              )
              .eq("role", "business")
              .limit(400);
            if (typeof query.abortSignal === "function") {
              query = query.abortSignal(controller.signal);
            }
            const { data, error } = await query;
            if (error) {
              console.warn("Supabase fallback failed", error);
            } else {
              rows = data || [];
            }
          } catch (err) {
            if (err?.name === "AbortError") {
              logCrashEvent({
                context: "public-businesses",
                kind: "timeout",
                message: "Supabase users query timed out after 12s",
              });
            } else {
              console.warn("Supabase fallback threw", err);
            }
          } finally {
            clearTimeout(timeoutId);
          }
        }

        if (!active || requestId !== ybRequestIdRef.current) return;

        if (!rows.length) {
          setYbBusinesses((prev) =>
            isSameBusinessList(prev, SAMPLE_BUSINESSES) ? prev : SAMPLE_BUSINESSES
          );
          setHasLoadedYb(true);
          setYbBusinessesError("Showing sample businesses — real data unavailable.");
        } else {
          const parseNum = (val) => {
            if (typeof val === "number" && Number.isFinite(val)) return val;
            const parsed = parseFloat(val);
            return Number.isFinite(parsed) ? parsed : null;
          };
          const jitterCoord = (index) => {
            const base = { lat: 33.7701, lng: -118.1937 }; // Long Beach core
            const step = 0.0025;
            const offsetLat = ((index % 6) - 3) * step;
            const offsetLng = (((Math.floor(index / 6) % 6) - 3) * step);
            return { lat: base.lat + offsetLat, lng: base.lng + offsetLng };
          };
          const mapped = rows
            .map((row, idx) => {
              const address = row.city ? `${row.address || ""}${row.address ? ", " : ""}${row.city}` : row.address || "";
              const lat = parseNum(row.latitude ?? row.lat ?? row.location_lat);
              const lng = parseNum(row.longitude ?? row.lng ?? row.location_lng);
              const hasCoords = typeof lat === "number" && typeof lng === "number" && lat !== 0 && lng !== 0;
              return {
                id: row.id,
                name: row.business_name || row.name || row.full_name || "Local business",
                category: row.category || "Local business",
                categoryLabel: row.category || "Local business",
                address,
                description: row.description || row.bio || "",
                website: row.website || "",
                imageUrl: row.profile_photo_url || row.photo_url || "",
                source: "supabase_users",
                coords: hasCoords ? { lat, lng } : null,
              };
            })
            .filter(Boolean);
          const next = mapped.length ? mapped : SAMPLE_BUSINESSES;
          setYbBusinesses((prev) => (isSameBusinessList(prev, next) ? prev : next));
          setHasLoadedYb(true);

          if (typeof window !== "undefined") {
            try {
              sessionStorage.setItem(
                "yb_customer_home_businesses",
                JSON.stringify(next)
              );
            } catch {
              /* ignore cache errors */
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load YourBarrio businesses", err);
        if (!active || requestId !== ybRequestIdRef.current) return;
        setYbBusinesses((prev) =>
          isSameBusinessList(prev, SAMPLE_BUSINESSES) ? prev : SAMPLE_BUSINESSES
        );
        setHasLoadedYb(true);
        setYbBusinessesError("Could not load businesses yet. Showing sample locations.");
      } finally {
        if (active && requestId === ybRequestIdRef.current) {
          setYbBusinessesLoading(false);
          logDataDiag("request:finish", {
            label: "home:yb-businesses",
            requestId,
          });
        }
      }
    };

    loadYb();

    return () => {
      active = false;
    };
  }, [supabase, logCrashEvent, isVisible]);

  useEffect(() => {
    const urlQuery = (searchParams?.get("q") || "").trim();
    const urlCategory = (searchParams?.get("category") || "").trim();
    const matchedCategory = BUSINESS_CATEGORIES.find(
      (category) => category.toLowerCase() === urlCategory.toLowerCase()
    );
    setSearch(urlQuery);
    setCategoryFilter(matchedCategory || "All");
  }, [searchParams]);

  // Guard against long/hung requests leaving loading on
  useEffect(() => {
    if (!ybBusinessesLoading) return;
    const timer = setTimeout(() => {
      setYbBusinessesLoading(false);
      setYbBusinessesError((prev) => prev || "Still loading businesses. Please try again.");
      logCrashEvent({
        context: "yb-businesses",
        kind: "timeout",
        message: "Businesses load exceeded 12s watchdog",
      });
    }, 12000);
    return () => clearTimeout(timer);
  }, [ybBusinessesLoading, logCrashEvent]);

  useEffect(() => {
    if (!allListingsLoading) return;
    const timer = setTimeout(() => {
      setAllListingsLoading(false);
      logCrashEvent({
        context: "all-listings",
        kind: "timeout",
        message: "All listings load exceeded 12s watchdog",
      });
    }, 12000);
    return () => clearTimeout(timer);
  }, [allListingsLoading, logCrashEvent]);

  // Keep map businesses in sync with fetched YB businesses (for list display)
  useEffect(() => {
    if (ybBusinesses.length) {
      setMapBusinesses(ybBusinesses);
    }
  }, [ybBusinesses]);


  useEffect(() => {
    if (hasInitialListings) return undefined;
    if (!isVisible && allListingsFetchedRef.current) return undefined;
    let active = true;
    const loadAll = async () => {
      const requestId = ++allListingsRequestIdRef.current;
      allListingsFetchedRef.current = true;
      const client = supabase ?? getSupabaseBrowserClient();
      if (!client) {
        setAllListingsLoading(false);
        return;
      }
      setAllListingsLoading((prev) => (hasLoadedListings ? prev : true));
      logDataDiag("request:start", { label: "home:listings", requestId });
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(new DOMException("Timeout", "AbortError")),
          12000
        );
        let query = client
          .from("listings")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(80);
        if (typeof query.abortSignal === "function") {
          query = query.abortSignal(controller.signal);
        }
        const { data, error } = await query;
        clearTimeout(timeoutId);
        if (!active || requestId !== allListingsRequestIdRef.current) return;
        if (error) {
          console.error("Load all listings failed", error);
          if (process.env.NEXT_PUBLIC_HOME_GRID_DIAG === "1") {
            console.log("[HOME_GRID_DIAG] setAllListings(empty) due to error");
          }
          setAllListings([]);
        } else {
          const next = data || [];
          if (process.env.NEXT_PUBLIC_HOME_GRID_DIAG === "1") {
            console.log("[HOME_GRID_DIAG] setAllListings", { length: next.length });
          }
          setAllListings(next);
          setHasLoadedListings(true);
          if (typeof window !== "undefined") {
            try {
              sessionStorage.setItem(
                "yb_customer_home_listings",
                JSON.stringify(next)
              );
            } catch {
              /* ignore cache errors */
            }
          }
        }
      } catch (err) {
        if (active && requestId === allListingsRequestIdRef.current) {
          if (err?.name === "AbortError") {
            logCrashEvent({
              context: "all-listings",
              kind: "timeout",
              message: "Listings query timed out after 12s",
            });
          } else {
            console.error("Load all listings threw", err);
          }
          if (process.env.NEXT_PUBLIC_HOME_GRID_DIAG === "1") {
            console.log("[HOME_GRID_DIAG] setAllListings(empty) due to exception");
          }
          setAllListings([]);
        }
      } finally {
        if (active && requestId === allListingsRequestIdRef.current) {
          setAllListingsLoading(false);
          logDataDiag("request:finish", {
            label: "home:listings",
            requestId,
          });
        }
      }
    };
    loadAll();
    return () => {
      active = false;
    };
  }, [supabase, hasLoadedListings, logCrashEvent, isVisible, hasInitialListings]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    setSupportsContentVisibility(
      typeof CSS !== "undefined" &&
        typeof CSS.supports === "function" &&
        CSS.supports("content-visibility: auto")
    );
    const updateColumns = () => {
      const width = window.innerWidth;
      const next =
        width >= 1280
          ? 6
          : width >= 1024
            ? 5
            : width >= 768
              ? 4
              : width >= 640
                ? 3
                : 2;
      setGridColumns(Math.max(1, next));
    };
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  const filteredListings = useMemo(() => {
    const categoryFilterNormalized = categoryFilter.trim().toLowerCase();
    let baseListings =
      !categoryFilterNormalized || categoryFilterNormalized === "all"
        ? allListings || []
        : (allListings || []).filter(
            (item) =>
              (item.category || "").trim().toLowerCase() === categoryFilterNormalized
          );
    return sortListingsByAvailability(baseListings);
  }, [allListings, categoryFilter]);

  const safeColumns = Math.max(1, gridColumns);
  const listingRows = useMemo(() => {
    if (!filteredListings.length) return [];
    const rows = [];
    for (let i = 0; i < filteredListings.length; i += safeColumns) {
      rows.push(filteredListings.slice(i, i + safeColumns));
    }
    return rows;
  }, [filteredListings, safeColumns]);

  const [isMobileSafari, setIsMobileSafari] = useState(false);
  const [showNearbySticky, setShowNearbySticky] = useState(false);
  const [mounted, setMounted] = useState(false);
  const stickyBarRef = useRef(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator?.userAgent || "";
    const isIOS = /iP(hone|od|ad)/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    setIsMobileSafari(isIOS && isSafari);
  }, []);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleScroll = () => {
      setShowNearbySticky(window.scrollY > 240);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const enableVirtualize = VIRTUALIZE && !isMobileSafari;

  const {
    virtualRows,
    totalHeight,
    startIndex,
    endIndex,
    rowStride,
    scrollTop,
    viewportHeight,
    containerHeight,
  } = useGridVirtualRows({
    rowCount: listingRows.length,
    rowHeight: Math.max(rowHeight, 1),
    rowGap,
    overscan: 4,
    containerRef: gridContainerRef,
  });

  const firstRowRef = useCallback((node) => {
    if (!node || typeof window === "undefined") return;
    const nextHeight = node.offsetHeight;
    if (nextHeight && Math.abs(nextHeight - rowHeight) > 1) {
      setRowHeight(nextHeight);
    }
    const styles = window.getComputedStyle(node);
    const nextGap = parseFloat(styles.rowGap || styles.gap || "0");
    if (Number.isFinite(nextGap) && Math.abs(nextGap - rowGap) > 0.5) {
      setRowGap(nextGap);
    }
  }, [rowHeight, rowGap]);

  const sortedHybridItems = useMemo(
    () => sortListingsByAvailability(hybridItems),
    [hybridItems]
  );

  const gridDiagEnabled = process.env.NEXT_PUBLIC_HOME_GRID_DIAG === "1";
  const allowGridDiag =
    gridDiagEnabled || process.env.NODE_ENV !== "production";
  const browseListingsLoggedRef = useRef(false);

  useEffect(() => {
    if (!allowGridDiag) return;
    console.log("[HOME_GRID_DIAG] metrics", {
      listings: filteredListings.length,
      rows: listingRows.length,
      columns: safeColumns,
      rowHeight,
      rowGap,
      rowStride,
      containerHeight,
      scrollTop,
      viewportHeight,
      startIndex,
      endIndex,
      totalHeight,
      virtualRows: virtualRows.length,
    });
  }, [
    allowGridDiag,
    filteredListings.length,
    listingRows.length,
    safeColumns,
    rowHeight,
    rowGap,
    rowStride,
    containerHeight,
    scrollTop,
    viewportHeight,
    startIndex,
    endIndex,
    totalHeight,
    virtualRows.length,
  ]);

  useEffect(() => {
    if (!allowGridDiag) return;
    if (browseListingsLoggedRef.current) return;
    if (!search) {
      console.log("[HOME_GRID_DIAG] BrowseListings render reached");
      browseListingsLoggedRef.current = true;
    }
  }, [allowGridDiag, search]);

  useEffect(() => {
    if (!allowGridDiag || search) return;
    const runProbe = () => {
      const gridEl = gridContainerRef.current;
      if (!gridEl) return;
      const rect = gridEl.getBoundingClientRect();
      const tiles = gridEl.querySelectorAll('[data-listing-tile="1"]');
      const firstTile = tiles[0];
      const tileRect = firstTile?.getBoundingClientRect?.() || null;
      const tileStyles = firstTile
        ? window.getComputedStyle(firstTile)
        : null;
      const suspicious = [];
      let node = gridEl;
      for (let i = 0; i < 10 && node; i += 1) {
        const cs = window.getComputedStyle(node);
        const overflow = `${cs.overflow}/${cs.overflowX}/${cs.overflowY}`;
        const height = cs.height;
        const maxHeight = cs.maxHeight;
        const display = cs.display;
        const opacity = cs.opacity;
        const visibility = cs.visibility;
        const transform = cs.transform;
        const position = cs.position;
        const zIndex = cs.zIndex;
        const isSuspicious =
          overflow.includes("hidden") ||
          height === "0px" ||
          maxHeight === "0px" ||
          display === "none" ||
          opacity === "0" ||
          visibility === "hidden" ||
          transform !== "none";
        if (isSuspicious) {
          suspicious.push({
            node: node.tagName?.toLowerCase(),
            className: node.className,
            overflow,
            height,
            maxHeight,
            display,
            opacity,
            visibility,
            transform,
            position,
            zIndex,
          });
          break;
        }
        node = node.parentElement;
      }
      console.log("[HOME_GRID_DIAG] visibility probe", {
        gridRect: rect,
        tileCount: tiles.length,
        tileRect,
        tileDisplay: tileStyles?.display,
        tileVisibility: tileStyles?.visibility,
        tileOpacity: tileStyles?.opacity,
        tilePosition: tileStyles?.position,
        tileZIndex: tileStyles?.zIndex,
        suspiciousAncestor: suspicious[0] || null,
      });
    };
    const timer = setTimeout(runProbe, 0);
    return () => clearTimeout(timer);
  }, [allowGridDiag, search, filteredListings.length, enableVirtualize]);

  const hasListings = filteredListings.length > 0;
  const hasRows = listingRows.length > 0;
  const virtualInvalid =
    !hasRows ||
    !Number.isFinite(totalHeight) ||
    totalHeight <= 0 ||
    !Number.isFinite(rowStride) ||
    rowStride <= 0 ||
    !Number.isFinite(startIndex) ||
    !Number.isFinite(endIndex) ||
    startIndex > endIndex ||
    virtualRows.length === 0;
  const fallbackAll = !hasRows && hasListings;
  const fallbackPartial = hasRows && virtualInvalid;
  const fallbackListings = fallbackAll
    ? filteredListings
    : filteredListings.slice(0, Math.min(filteredListings.length, 16));
  const renderListingTile = (item, listIndex) => {
    const inventory = normalizeInventory(item);
    const badgeStyle = getAvailabilityBadgeStyle(
      inventory.availability,
      isLight
    );
    const cover = coverFor(item.photo_url);
    const itemKey =
      item.id ?? item.listing_id ?? `${item.title || "listing"}-${listIndex}`;
    return (
      <Link
        key={itemKey}
        href={`/customer/listings/${item.id}`}
        prefetch={false}
        data-safe-nav="1"
        data-listing-tile="1"
        className="group relative flex flex-col overflow-hidden rounded-lg border border-white/12 bg-white/5 hover:border-white/30 hover:bg-white/10 transition shadow-sm pointer-events-auto touch-manipulation"
        data-clickdiag={clickDiagEnabled ? "tile" : undefined}
        data-clickdiag-tile-id={clickDiagEnabled ? item.id || listIndex : undefined}
        data-clickdiag-bound={clickDiagEnabled ? "tile" : undefined}
        onClickCapture={diagTileClick("REACT_TILE_CAPTURE", item.id || listIndex)}
        onClick={diagTileClick("REACT_TILE_BUBBLE", item.id || listIndex)}
        style={{
          ...(supportsContentVisibility ? { contentVisibility: "auto" } : {}),
          containIntrinsicSize: "320px 360px",
          contain: "layout paint size",
          ...(allowGridDiag ? { outline: "1px solid lime" } : {}),
        }}
      >
        <div className="relative h-56 w-full overflow-hidden bg-white/5 border-b border-white/10 flex items-center justify-center">
          {cover ? (
            <SafeImage
              src={cover}
              alt={item.title}
              className="h-full w-full p-3 transition-transform duration-300 group-hover:scale-[1.02]"
              style={{ objectFit: "contain", objectPosition: "center" }}
              fallbackSrc="/business-placeholder.png"
              loading={listIndex < 8 ? "eager" : "lazy"}
              fetchPriority={listIndex < 8 ? "high" : "auto"}
              decoding="async"
            />
          ) : (
            <div className={`h-full w-full flex items-center justify-center text-[11px] ${textTone.subtle}`}>
              No image
            </div>
          )}
        </div>
        <div className="flex flex-col flex-1 p-4 gap-2">
          <p className={`text-xs font-medium ${textTone.subtle} uppercase tracking-wide`}>
            {item.category || "Listing"}
            {item.city ? ` · ${item.city}` : ""}
          </p>
          <h3 className={`text-base font-semibold ${textTone.base} line-clamp-2 min-h-[3rem]`}>
            {item.title}
          </h3>
          <div className={`mt-auto text-lg font-semibold ${textTone.strong}`}>
            {item.price ? `$${item.price}` : "Price TBD"}
          </div>
        </div>
      </Link>
    );
  };

  const renderNearbySection = (compact = false) => (
    <div
      className={`grid grid-cols-1 gap-2 mt-0 pointer-events-auto ${
        compact ? "" : "relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen"
      }`}
    >
      <div
        className={`border border-white/10 ${
          compact ? "bg-black/80 shadow-lg" : "bg-white/5 backdrop-blur-xl shadow-xl"
        } pointer-events-auto`}
      >
        {!compact ? (
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-5 sm:px-6 md:px-8 lg:px-12 pt-2 pb-1">
            <div className={`text-sm uppercase tracking-[0.18em] ${textTone.subtle}`}>
              Nearby businesses
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-2 text-xs ${textTone.soft} bg-white/5 border border-white/10 px-3 py-1 backdrop-blur`}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {filteredBusinesses.length} matches live
              </div>
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                disabled={!mapAvailable}
                className={`px-4 py-2 rounded-full border border-white/20 bg-white/10 text-xs font-semibold ${textTone.base} hover:border-white/40 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition pointer-events-auto`}
              >
                Map
              </button>
              <button
                type="button"
                onClick={() => scrollGallery(-1)}
                className={`h-8 w-8 rounded-full border border-white/20 bg-white/5 ${textTone.base} hover:border-white/40`}
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-4 w-4 mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => scrollGallery(1)}
                className={`h-8 w-8 rounded-full border border-white/20 bg-white/5 ${textTone.base} hover:border-white/40`}
                aria-label="Scroll right"
              >
                <ChevronRight className="h-4 w-4 mx-auto" />
              </button>
            </div>
          </div>
        ) : null}
        <div
          ref={compact ? undefined : galleryRef}
          className={`flex flex-nowrap overflow-x-auto snap-x snap-mandatory ${
            compact ? "" : "border-t border-white/10 px-5 sm:px-6 md:px-8 lg:px-12"
          }`}
          onPointerDown={handleTilePointerDown}
          onPointerMove={handleTilePointerMove}
          onPointerUp={handleTilePointerUp}
          onPointerCancel={handleTilePointerCancel}
          onClickCapture={handleTileClickCapture}
        >
          {filteredBusinesses.map((biz) => (
            <Link
              key={biz.id || biz.name}
              href={biz?.id ? `/customer/b/${biz.id}` : "#"}
              prefetch={false}
              data-safe-nav="1"
              className={`${compact ? "h-[88px]" : "h-[220px]"} snap-start text-left border-r border-white/10 bg-white/5 hover:bg-white/10 transition shadow-sm rounded-none last:border-r-0 flex flex-col overflow-hidden`}
              style={{
                width: compact ? "200px" : "260px",
                minWidth: compact ? "200px" : "260px",
                maxWidth: compact ? "200px" : "260px",
                flex: compact ? "0 0 200px" : "0 0 260px",
              }}
              onClick={(event) => {
                diagTileClick("REACT_TILE_BUBBLE", biz.id || biz.name)(event);
                if (!biz?.id) event.preventDefault();
              }}
              data-clickdiag={clickDiagEnabled ? "tile" : undefined}
              data-clickdiag-tile-id={clickDiagEnabled ? biz.id || biz.name : undefined}
              data-clickdiag-bound={clickDiagEnabled ? "tile" : undefined}
              onClickCapture={diagTileClick("REACT_TILE_CAPTURE", biz.id || biz.name)}
            >
              <div className={`${compact ? "h-full" : "h-24"} w-full ${compact ? "" : "border-b border-white/10"} bg-white/5 flex items-center ${compact ? "gap-2 px-2" : "justify-center"} flex-shrink-0`}>
                {businessPhotoFor(biz) ? (
                  <div className={`${compact ? "h-14 w-14 shrink-0" : "h-full w-full"}`}>
                    <SafeImage
                      src={businessPhotoFor(biz)}
                      alt={biz.name || "Business"}
                      className="block h-full w-full object-contain"
                      fallbackSrc="/business-placeholder.png"
                    />
                  </div>
                ) : (
                  <div className={`text-[11px] ${textTone.subtle}`}>No photo</div>
                )}
                {compact ? (
                  <div className="min-w-0">
                    <div className="text-sm font-semibold line-clamp-1 !text-white">
                      {biz.name}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className={`${compact ? "hidden" : "p-3 space-y-2"} flex-1 flex flex-col`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold line-clamp-1">
                      {biz.name}
                    </div>
                    <div className={`text-xs ${textTone.soft}`}>
                      {biz.categoryLabel || biz.category || "Local spot"}
                    </div>
                  </div>
                  {biz.distance_km ? (
                    <div className={`text-[11px] ${textTone.soft} bg-white/10 border border-white/10 px-2 py-1`}>
                      {biz.distance_km.toFixed(1)} km
                    </div>
                  ) : null}
                </div>
                {biz.address ? (
                  <div className={`text-xs ${textTone.subtle} line-clamp-1`}>{biz.address}</div>
                ) : (
                  <div className={`text-xs ${textTone.subtle}`}>&nbsp;</div>
                )}
                {biz.description ? (
                  <div className={`text-sm ${textTone.tint} leading-snug line-clamp-2`}>
                    {biz.description}
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
          {!filteredBusinesses.length ? (
            <div className={`text-sm ${textTone.soft}`}>
              {ybBusinessesLoading ? "Loading businesses..." : ybBusinessesError || "No matches found."}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );


  useEffect(() => {
    let isActive = true;
    const requestId = ++hybridRequestIdRef.current;
    const term = search.trim();
    const categoryValue = categoryFilter.trim();

    const client = supabase ?? getSupabaseBrowserClient();
    if (!client) return undefined;

    if (!term) {
      setHybridItems([]);
      setHybridItemsError(null);
      setHybridItemsLoading(false);
      return undefined;
    }

    const loadHybridItems = async () => {
      setHybridItemsLoading(true);
      setHybridItemsError(null);
      logDataDiag("request:start", { label: "home:hybrid-search", requestId });

      const safe = term.replace(/[%_]/g, "");
      if (!safe) {
        setHybridItems([]);
        setHybridItemsLoading(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(new DOMException("Timeout", "AbortError")),
        12000
      );

      try {
        let query = client
          .from("listings")
          .select(
            "id,title,description,price,category,city,photo_url,business_id,created_at,inventory_status,inventory_quantity,low_stock_threshold,inventory_last_updated_at"
          )
          .or(
            `title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`
          )
          .order("created_at", { ascending: false })
          .limit(8);
        if (categoryValue && categoryValue !== "All") {
          query = query.eq("category", categoryValue);
        }
        if (typeof query.abortSignal === "function") {
          query = query.abortSignal(controller.signal);
        }

        const { data, error } = await query;

        if (!isActive || requestId !== hybridRequestIdRef.current) return;

        if (error) {
          console.error("Hybrid item search failed", error);
          setHybridItemsError("Could not load item matches right now.");
          setHybridItems([]);
        } else {
          setHybridItems(data || []);
        }
      } catch (err) {
        if (!isActive || requestId !== hybridRequestIdRef.current) return;
        if (err?.name === "AbortError") {
          logCrashEvent({
            context: "hybrid-search",
            kind: "timeout",
            message: "Hybrid search query timed out after 12s",
          });
          setHybridItemsError("Search is taking too long. Please try again.");
        } else {
          console.error("Hybrid item search threw", err);
          setHybridItemsError("Could not load item matches right now.");
        }
        setHybridItems([]);
      } finally {
        clearTimeout(timeoutId);
        if (isActive && requestId === hybridRequestIdRef.current) {
          setHybridItemsLoading(false);
          logDataDiag("request:finish", {
            label: "home:hybrid-search",
            requestId,
          });
        }
      }
    };

    loadHybridItems();

    return () => {
      isActive = false;
    };
  }, [search, supabase, logCrashEvent, categoryFilter]);

  if (loadingUser && !user) {
    return (
      <div className={`min-h-screen ${textTone.base} relative px-6 pt-3`}>
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[#05010d]" />
          <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
          <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
          <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
        </div>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="h-12 w-12 rounded-full border-4 border-white/10 border-t-white/70 animate-spin mx-auto" />
            <p className={`text-lg ${textTone.muted}`}>Loading your account...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      className={`relative w-full min-h-screen ${textTone.base} pb-4 pt-0 md:pt-0 -mt-28 md:-mt-20`}
      data-clickdiag={clickDiagEnabled ? "home" : undefined}
    >

      {/* Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
        <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
      </div>

      <div
        className="w-full px-5 sm:px-6 md:px-8 lg:px-12 relative z-10"
        data-home-content="1"
      >
        <div className="w-full max-w-none">
        <div style={{ minHeight: "320px" }}>
          {authReady ? (
            <>
              {search ? (
                <div className="rounded-2xl border border-white/12 bg-white/5 backdrop-blur-xl shadow-xl px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={`text-[10px] uppercase tracking-[0.22em] ${textTone.subtle}`}>
                        AI picks
                      </p>
                      <p className="text-lg font-semibold">
                        Items matching “{search}”
                      </p>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${textTone.soft}`}>
                      {hybridItemsLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Scanning listings</span>
                        </>
                      ) : (
                        <>
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                          <span>{hybridItems.length} item hits</span>
                        </>
                      )}
                    </div>
                  </div>

                  {hybridItemsError ? (
                    <div className="mt-3 text-sm text-rose-200">
                      {hybridItemsError}
                    </div>
                  ) : null}

                  {!hybridItemsLoading && !hybridItemsError && hybridItems.length === 0 ? (
                    <div className={`mt-3 text-sm ${textTone.soft}`}>
                      No items yet. Try a category like “coffee”, “salon”, or “groceries”.
                    </div>
                  ) : null}

                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    {sortedHybridItems.map((item, idx) => {
                      const inventory = normalizeInventory(item);
                      const badgeStyle = getAvailabilityBadgeStyle(
                        inventory.availability,
                        isLight
                      );
                      return (
                      <a
                        key={item.id}
                        href={`/customer/listings/${item.id}`}
                        className="group rounded-xl border border-white/12 bg-white/5 hover:border-white/30 hover:bg-white/10 transition overflow-hidden flex gap-3 pointer-events-auto touch-manipulation"
                        target="_self"
                        data-safe-nav="1"
                        data-clickdiag={clickDiagEnabled ? "tile" : undefined}
                        data-clickdiag-tile-id={clickDiagEnabled ? item.id : undefined}
                        data-clickdiag-bound={clickDiagEnabled ? "tile" : undefined}
                        onClickCapture={diagTileClick("REACT_TILE_CAPTURE", item.id || idx)}
                        onClick={diagTileClick("REACT_TILE_BUBBLE", item.id || idx)}
                      >
                        {coverFor(item.photo_url) ? (
                          <SafeImage
                            src={coverFor(item.photo_url)}
                            alt={item.title}
                            className="h-20 w-20 object-cover rounded-lg border border-white/10"
                            fallbackSrc="/business-placeholder.png"
                          />
                        ) : (
                          <div className={`h-20 w-20 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-[11px] ${textTone.subtle}`}>
                            No image
                          </div>
                        )}
                        <div className="flex-1 pr-2 py-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="text-sm font-semibold leading-snug">
                              {item.title}
                            </div>
                            {item.price ? (
                              <div className={`text-sm font-semibold ${textTone.strong}`}>
                                ${item.price}
                              </div>
                            ) : null}
                          </div>
                          <div className={`text-[11px] uppercase tracking-wide ${textTone.faint} mt-1`}>
                            {item.category || "Listing"}
                            {item.city ? ` · ${item.city}` : ""}
                          </div>
                          <span
                            className="mt-2 inline-flex items-center rounded-full border bg-transparent px-2 py-1 text-[10px] font-semibold"
                            style={
                              badgeStyle
                                ? { color: badgeStyle.color, borderColor: badgeStyle.border }
                                : undefined
                            }
                          >
                            {inventory.label}
                          </span>
                          {item.description ? (
                            <p className={`text-xs ${textTone.soft} mt-1 line-clamp-2`}>
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                      </a>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {showNearbySticky && mounted
                ? createPortal(
                    <div
                      className="fixed top-20 sm:top-20 inset-x-0 z-[4800] pointer-events-auto isolate will-change-transform"
                      data-sticky-nav-block="1"
                      style={{
                        transform: "translateZ(0)",
                        WebkitBackfaceVisibility: "hidden",
                        backfaceVisibility: "hidden",
                      }}
                    >
                      <div className="w-full border-y border-white/10 bg-black/85 shadow-lg pointer-events-auto">
                        <div
                          ref={stickyBarRef}
                          className="w-full px-5 sm:px-6 md:px-8 lg:px-12 py-2"
                        >
                          {renderNearbySection(true)}
                        </div>
                      </div>
                    </div>,
                    document.body
                  )
                : null}

              <div
                onClickCapture={handleHomeCapture}
                data-clickdiag={clickDiagEnabled ? "home-grid" : undefined}
              >
                {renderNearbySection(false)}
              </div>

            </>
          ) : (
            <div className="space-y-4">
              <div className="h-12 w-32 rounded-full bg-white/5 border border-white/10" />
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-4 space-y-3">
                <div className="h-4 w-48 rounded bg-white/10" />
                <div className="h-4 w-64 rounded bg-white/10" />
                <div className="h-4 w-40 rounded bg-white/10" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl h-[240px]" />
                <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl h-[240px]" />
              </div>
            </div>
          )}
        </div>

        {!search && (
          <div
            className="space-y-3 mt-8 sm:mt-4 relative z-10"
            data-home-tiles="1"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 relative z-10">
              <div>
                <p className="text-lg font-semibold">Browse listings</p>
              </div>
              {allListingsLoading ? (
                <div className={`flex items-center gap-2 text-sm ${textTone.soft}`}>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading
                </div>
              ) : null}
            </div>
            {filteredListings.length ? (
              !enableVirtualize ? (
                <div
                  ref={gridContainerRef}
                  className="grid gap-3 mt-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 yb-tile-scroll-guard-y"
                  onPointerDown={handleTilePointerDown}
                  onPointerMove={handleTilePointerMove}
                  onPointerUp={handleTilePointerUp}
                  onPointerCancel={handleTilePointerCancel}
                  onClickCapture={handleTileClickCapture}
                  style={allowGridDiag ? { outline: "1px solid red" } : undefined}
                >
                  {filteredListings.map((item, idx) => {
                    const inventory = normalizeInventory(item);
                    const badgeStyle = getAvailabilityBadgeStyle(
                      inventory.availability,
                      isLight
                    );
                    const cover = coverFor(item.photo_url);
                    return (
                      <Link
                        key={item.id || idx}
                        href={`/customer/listings/${item.id}`}
                        prefetch={false}
                        data-safe-nav="1"
                        data-listing-tile="1"
                        className="group relative flex flex-col overflow-hidden rounded-lg border border-white/12 bg-white/5 hover:border-white/30 hover:bg-white/10 transition shadow-sm pointer-events-auto touch-manipulation"
                        data-clickdiag={clickDiagEnabled ? "tile" : undefined}
                        data-clickdiag-tile-id={clickDiagEnabled ? item.id || idx : undefined}
                        data-clickdiag-bound={clickDiagEnabled ? "tile" : undefined}
                        onClickCapture={diagTileClick("REACT_TILE_CAPTURE", item.id || idx)}
                        onClick={diagTileClick("REACT_TILE_BUBBLE", item.id || idx)}
                        style={allowGridDiag ? { outline: "1px solid lime" } : undefined}
                      >
                        <div className="relative h-56 w-full overflow-hidden bg-white/5 border-b border-white/10 flex items-center justify-center">
                          {cover ? (
                            <SafeImage
                              src={cover}
                              alt={item.title}
                              className="h-full w-full p-3 transition-transform duration-300 group-hover:scale-[1.02]"
                              style={{ objectFit: "contain", objectPosition: "center" }}
                              fallbackSrc="/business-placeholder.png"
                              loading={idx < 8 ? "eager" : "lazy"}
                              fetchPriority={idx < 8 ? "high" : "auto"}
                            />
                          ) : (
                            <div className={`h-full w-full flex items-center justify-center text-[11px] ${textTone.subtle}`}>
                              No image
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col flex-1 p-4 gap-2">
                          <p className={`text-xs font-medium ${textTone.subtle} uppercase tracking-wide`}>
                            {item.category || "Listing"}
                            {item.city ? ` · ${item.city}` : ""}
                          </p>
                          <h3 className={`text-base font-semibold ${textTone.base} line-clamp-2 min-h-[3rem]`}>
                            {item.title}
                          </h3>
                          <div className={`mt-auto text-lg font-semibold ${textTone.strong}`}>
                            {item.price ? `$${item.price}` : "Price TBD"}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div
                  ref={gridContainerRef}
                  className="relative mt-3 yb-tile-scroll-guard-y"
                  onPointerDown={handleTilePointerDown}
                  onPointerMove={handleTilePointerMove}
                  onPointerUp={handleTilePointerUp}
                  onPointerCancel={handleTilePointerCancel}
                  onClickCapture={handleTileClickCapture}
                  style={{
                    contain: "layout paint size",
                    ...(allowGridDiag ? { outline: "1px solid red" } : {}),
                  }}
                >
                  {fallbackAll || fallbackPartial ? (
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {fallbackListings.map((item, idx) =>
                        renderListingTile(item, idx)
                      )}
                    </div>
                  ) : (
                    <>
                      <div style={{ height: totalHeight }} aria-hidden="true" />
                      {virtualRows.map(({ index: rowIndex, start }) => {
                        const row = listingRows[rowIndex] || [];
                        return (
                          <div
                            key={`row-${rowIndex}`}
                            ref={rowIndex === 0 ? firstRowRef : undefined}
                            className="absolute left-0 right-0 grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                            style={{ transform: `translateY(${start}px)` }}
                          >
                            {row.map((item, itemIdx) => {
                              const listIndex = rowIndex * safeColumns + itemIdx;
                              return renderListingTile(item, listIndex);
                            })}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )
            ) : (
              <div className={`text-sm ${textTone.soft} mt-3`}>
                {allListingsLoading
                  ? "Loading listings..."
                  : "No listings available yet."}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
      <MapModal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        mapEnabled={mapEnabled}
        mapBusinesses={mapBusinesses}
        onBusinessesChange={setMapBusinesses}
        clickDiagEnabled={clickDiagEnabled}
      />
    </section>
  );
}

export default function CustomerHomeClient({ initialListings }) {
  const safeNavFlag = process.env.NEXT_PUBLIC_HOME_BISECT_SAFE_NAV === "1";
  const { theme, hydrated } = useTheme();
  const isLight = hydrated ? theme === "light" : true;
  return (
    <CustomerHomeErrorBoundary isLight={isLight}>
      {safeNavFlag ? <SafeNavFallback /> : null}
      <HomeGuard fallback={<HomeGuardFallback />}>
        <GuaranteedNavCapture />
        <CustomerHomePageInner initialListings={initialListings} />
      </HomeGuard>
    </CustomerHomeErrorBoundary>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import GoogleMapClient from "@/components/GoogleMapClient";

export default function CustomerHomePage() {
  const searchParams = useSearchParams();
  const { user, loadingUser, supabase } = useAuth();
  const [search, setSearch] = useState("");
  const [mapBusinesses, setMapBusinesses] = useState([]);
  const [mapControls, setMapControls] = useState(null);
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [hybridItems, setHybridItems] = useState([]);
  const [hybridItemsLoading, setHybridItemsLoading] = useState(false);
  const [hybridItemsError, setHybridItemsError] = useState(null);
  const [businessListings, setBusinessListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState(null);
  const [allListings, setAllListings] = useState([]);
  const [allListingsLoading, setAllListingsLoading] = useState(false);
  const lastUrlSearchRef = useRef("");
  const galleryRef = useRef(null);
  const mapReadySearchRef = useRef(false);

  const filteredBusinesses = useMemo(() => {
    const source = mapBusinesses;
    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source.filter((biz) => {
      const name = biz.name?.toLowerCase() || "";
      const category =
        biz.categoryLabel?.toLowerCase() ||
        biz.category?.toLowerCase() ||
        "";
      const desc = biz.description?.toLowerCase() || "";
      return (
        name.includes(q) ||
        category.includes(q) ||
        desc.includes(q)
      );
    });
  }, [mapBusinesses, search]);

  const handleSelectBusiness = (biz) => {
    setSelectedBusiness(biz);
    mapControls?.focusBusiness?.(biz);
  };

  const scrollGallery = (dir) => {
    const el = galleryRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  useEffect(() => {
    const urlQuery = (searchParams?.get("q") || "").trim();
    setSearch(urlQuery);
    if (!mapControls) return;
    if (urlQuery === lastUrlSearchRef.current) return;
    lastUrlSearchRef.current = urlQuery;
    mapControls.search?.(urlQuery);
    setSearchTrigger((n) => n + 1);
  }, [searchParams, mapControls]);

  useEffect(() => {
    if (!mapControls || mapReadySearchRef.current) return;
    const urlQuery = (searchParams?.get("q") || "").trim();
    mapControls.search?.(urlQuery);
    setSearchTrigger((n) => n + 1);
    mapReadySearchRef.current = true;
  }, [mapControls, searchParams]);

  useEffect(() => {
    let active = true;
    const loadAll = async () => {
      if (!supabase) return;
      setAllListingsLoading(true);
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);
      if (!active) return;
      if (error) {
        console.error("Load all listings failed", error);
        setAllListings([]);
      } else {
        setAllListings(data || []);
      }
      setAllListingsLoading(false);
    };
    loadAll();
    return () => {
      active = false;
    };
  }, [supabase]);

  const groupedListings = useMemo(() => {
    const groups = {};
    (allListings || []).forEach((item) => {
      const key = item.category?.trim() || "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).map(([category, items]) => ({
      category,
      items,
    }));
  }, [allListings]);

  useEffect(() => {
    let isActive = true;
    const term = search.trim();

    if (!supabase) return undefined;

    if (!term) {
      setHybridItems([]);
      setHybridItemsError(null);
      setHybridItemsLoading(false);
      return undefined;
    }

    const loadHybridItems = async () => {
      setHybridItemsLoading(true);
      setHybridItemsError(null);

      const safe = term.replace(/[%_]/g, "");
      if (!safe) {
        setHybridItems([]);
        setHybridItemsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("listings")
        .select(
          "id,title,description,price,category,city,photo_url,business_id,created_at"
        )
        .or(
          `title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`
        )
        .order("created_at", { ascending: false })
        .limit(8);

      if (!isActive) return;

      if (error) {
        console.error("Hybrid item search failed", error);
        setHybridItemsError("Could not load item matches right now.");
        setHybridItems([]);
      } else {
        setHybridItems(data || []);
      }
      setHybridItemsLoading(false);
    };

    loadHybridItems();

    return () => {
      isActive = false;
    };
  }, [search, supabase]);

  useEffect(() => {
    let isActive = true;

    if (!selectedBusiness || selectedBusiness.source !== "supabase_users" || !supabase) {
      setBusinessListings([]);
      setListingsLoading(false);
      setListingsError(null);
      return () => {
        isActive = false;
      };
    }

    const loadListings = async () => {
      setListingsLoading(true);
      setListingsError(null);

      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("business_id", selectedBusiness.id)
        .order("created_at", { ascending: false });

      if (!isActive) return;

      if (error) {
        console.error("Failed to load business listings", error);
        setListingsError("Could not load listings for this business.");
        setBusinessListings([]);
      } else {
        setBusinessListings(data || []);
      }

      setListingsLoading(false);
    };

    loadListings();

    return () => {
      isActive = false;
    };
  }, [selectedBusiness, supabase]);

  if (loadingUser) {
    return (
      <div className="min-h-screen text-white relative px-6 pt-3">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[#05010d]" />
          <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
          <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
          <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
        </div>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="h-12 w-12 rounded-full border-4 border-white/10 border-t-white/70 animate-spin mx-auto" />
            <p className="text-lg text-white/80">Loading your account...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white relative px-6 pb-2 pt-0 md:pt-1">

      {/* Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
        <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="flex flex-col gap-2"
        >
          <p className="text-xs uppercase tracking-[0.22em] text-white/60">YourBarrio</p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
            <h1 className="text-3xl font-semibold leading-tight">
              {search ? `Results for “${search}”` : "Discover what’s open near you"}
            </h1>
            <div className="inline-flex items-center gap-2 text-xs text-white/70 bg-white/5 border border-white/10 rounded-full px-3 py-1 backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {filteredBusinesses.length} matches live
            </div>
          </div>
        </motion.div>

        {search ? (
          <div className="rounded-2xl border border-white/12 bg-white/5 backdrop-blur-xl shadow-xl px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/60">
                  AI picks
                </p>
                <p className="text-lg font-semibold">
                  Items matching “{search}”
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/70">
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
              <div className="mt-3 text-sm text-white/70">
                No items yet. Try a category like “coffee”, “salon”, or “groceries”.
              </div>
            ) : null}

            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              {hybridItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/customer/listings/${item.id}`}
                  className="group rounded-xl border border-white/12 bg-white/5 hover:border-white/30 hover:bg-white/10 transition overflow-hidden flex gap-3"
                >
                  {item.photo_url ? (
                    <img
                      src={item.photo_url}
                      alt={item.title}
                      className="h-20 w-20 object-cover rounded-lg border border-white/10"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-[11px] text-white/60">
                      No image
                    </div>
                  )}
                  <div className="flex-1 pr-2 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold leading-snug">
                        {item.title}
                      </div>
                      {item.price ? (
                        <div className="text-sm font-semibold text-white/90">
                          ${item.price}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-white/50 mt-1">
                      {item.category || "Listing"}
                      {item.city ? ` · ${item.city}` : ""}
                    </div>
                    {item.description ? (
                      <p className="text-xs text-white/70 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* Header with gallery + map (compact) */}
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 col-span-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm uppercase tracking-[0.18em] text-white/60">Browse spots</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollGallery(-1)}
                  className="h-8 w-8 rounded-full border border-white/20 bg-white/5 text-white hover:border-white/40"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-4 w-4 mx-auto" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollGallery(1)}
                  className="h-8 w-8 rounded-full border border-white/20 bg-white/5 text-white hover:border-white/40"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-4 w-4 mx-auto" />
                </button>
              </div>
            </div>
            <div
              ref={galleryRef}
              className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
            >
              {filteredBusinesses.map((biz) => (
                <button
                  type="button"
                  key={biz.id || biz.name}
                  className={`min-w-[220px] max-w-[240px] snap-start text-left rounded-2xl border border-white/10 bg-white/5 p-3 hover:border-white/30 hover:bg-white/10 transition shadow-sm ${
                    selectedBusiness?.id === biz.id ? "border-white/40 bg-white/10" : ""
                  }`}
                  onClick={() => handleSelectBusiness(biz)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold">{biz.name}</span>
                        {biz.source === "supabase_users" ? (
                          <span className="yb-badge inline-flex items-center text-[10px] px-2 py-[2px] rounded-full border font-semibold">
                            YB
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-white/70">
                        {biz.categoryLabel || biz.category || "Local spot"}
                      </div>
                      {biz.address ? (
                        <div className="text-xs text-white/60 line-clamp-2">{biz.address}</div>
                      ) : null}
                    </div>
                    {biz.distance_km ? (
                      <div className="text-xs text-white/70 bg-white/10 border border-white/10 rounded-full px-2 py-1">
                        {biz.distance_km.toFixed(1)} km
                      </div>
                    ) : null}
                  </div>
                  {biz.description ? (
                    <div className="text-sm text-white/75 leading-snug line-clamp-2 mt-1">
                      {biz.description}
                    </div>
                  ) : null}
                </button>
              ))}
              {!filteredBusinesses.length ? (
                <div className="text-sm text-white/70">No matches found.</div>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-2 col-span-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-white/85 truncate">
                  {selectedBusiness ? selectedBusiness.name : "Map"}
                </div>
              </div>
              <GoogleMapClient
                radiusKm={25}
                showBusinessErrors={false}
                containerClassName="w-full"
                cardClassName="bg-transparent border-0 text-white"
                mapClassName="h-[180px] rounded-2xl overflow-hidden border border-white/12 shadow-lg"
                title=""
                enableCategoryFilter={false}
                enableSearch={false}
                onBusinessesChange={setMapBusinesses}
                onControlsReady={setMapControls}
                externalSearchTerm={search}
                externalSearchTrigger={searchTrigger}
              />
            </div>
          </div>
        </div>

        {selectedBusiness?.source === "supabase_users" ? (
          <div className="rounded-2xl border border-white/12 bg-white/5 backdrop-blur-xl overflow-hidden flex flex-col shadow-xl">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{selectedBusiness.name}</div>
                <div className="text-xs text-white/60">Listings from this business</div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {listingsLoading ? (
                <div className="text-sm text-white/70">Loading listings...</div>
              ) : listingsError ? (
                <div className="text-sm text-red-200">{listingsError}</div>
              ) : businessListings.length ? (
                businessListings.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 flex gap-3"
                  >
                    {item.photo_url ? (
                      <img
                        src={item.photo_url}
                        alt={item.title}
                        className="h-20 w-20 rounded-lg object-cover border border-white/10"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-[11px] text-white/60">
                        No image
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{item.title}</div>
                          {item.category ? (
                            <div className="text-[11px] uppercase tracking-wide text-white/50 mt-1">
                              {item.category}
                            </div>
                          ) : null}
                        </div>
                        {item.price ? (
                          <div className="text-sm font-semibold text-white/90">
                            ${item.price}
                          </div>
                        ) : null}
                      </div>
                      {item.description ? (
                        <p className="text-sm text-white/75 mt-2 leading-snug">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-white/70">
                  This business hasn’t shared any listings yet.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {!search && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">All listings</p>
                <p className="text-lg font-semibold">Browse by category</p>
              </div>
              {allListingsLoading ? (
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading
                </div>
              ) : null}
            </div>

            <div className="space-y-5">
              {groupedListings.map(({ category, items }) => (
                <div key={category} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="text-sm font-semibold text-white/90">
                      {category}
                    </div>
                    <div className="text-xs text-white/60">{items.length} items</div>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                    {items.map((item) => (
                      <Link
                        key={item.id}
                        href={`/listings/${item.id}`}
                        className="rounded-xl border border-white/10 bg-white/5 p-3 hover:border-white/30 hover:bg-white/10 transition flex gap-3"
                      >
                        {item.photo_url ? (
                          <img
                            src={item.photo_url}
                            alt={item.title}
                            className="h-16 w-16 rounded-lg object-cover border border-white/10"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-[11px] text-white/60">
                            No image
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{item.title}</div>
                          {item.price ? (
                            <div className="text-xs text-white/75">${item.price}</div>
                          ) : null}
                          {item.description ? (
                            <p className="text-xs text-white/60 line-clamp-2 mt-1">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

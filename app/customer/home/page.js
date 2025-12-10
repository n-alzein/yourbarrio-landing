"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import GoogleMapClient from "@/components/GoogleMapClient";

export default function CustomerHomePage() {
  const { user, loadingUser, supabase } = useAuth();
  const [search, setSearch] = useState("");
  const [mapBusinesses, setMapBusinesses] = useState([]);
  const [mapControls, setMapControls] = useState(null);
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [showMapMobile, setShowMapMobile] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [activePanel, setActivePanel] = useState("map"); // "map" | "listings"
  const [businessListings, setBusinessListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState(null);

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

  const handleSubmitSearch = (e) => {
    e.preventDefault();
    mapControls?.search?.(search.trim());
    setSearchTrigger((n) => n + 1);
  };

  const handleSelectBusiness = (biz) => {
    setSelectedBusiness(biz);
    setActivePanel("map");
    setShowMapMobile(true);
    mapControls?.focusBusiness?.(biz);
  };

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
      <div className="min-h-screen text-white relative pt-8 px-6">
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

  const firstName = user?.full_name
    ? user.full_name.split(" ")[0]
    : "Welcome";

  return (
    <div className="min-h-screen text-white relative pt-0 px-6">

      {/* Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
        <div className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-pink-500/30 blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.1 }}
          className="rounded-3xl border border-white/12 bg-white/5 backdrop-blur-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-6 pt-6">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/60">Map</div>
              <div className="text-2xl font-semibold">See what’s open near you</div>
              <p className="text-sm text-white/70 mt-1">Live discovery within 25km — drag, zoom, and tap to connect.</p>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between lg:hidden mb-3">
              <div className="text-sm text-white/80">Browse results</div>
              <button
                type="button"
                onClick={() => setShowMapMobile((v) => !v)}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/15"
              >
                {showMapMobile ? "Show list" : "Show map"}
              </button>
            </div>

            <div className="grid lg:grid-cols-5 gap-4">
              <div
                className={`lg:col-span-2 flex flex-col gap-3 ${
                  showMapMobile ? "hidden lg:flex" : "flex"
                }`}
              >
                <form
                  onSubmit={handleSubmitSearch}
                  className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-2 shadow-sm"
                >
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search coffee, groceries, salon..."
                    className="w-full bg-transparent text-sm text-white placeholder:text-white/60 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="text-xs text-black bg-white rounded-full px-3 py-1 font-semibold hover:bg-white/90"
                  >
                    Search
                  </button>
                </form>

                <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                  {filteredBusinesses.map((biz) => (
                    <div
                      key={biz.id || biz.name}
                      className={`rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition shadow-sm cursor-pointer ${
                        selectedBusiness?.id === biz.id ? "border-white/30 bg-white/10" : ""
                      }`}
                      onClick={() => handleSelectBusiness(biz)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold">{biz.name}</span>
                            {biz.source === "supabase_users" ? (
                              <span className="yb-badge inline-flex items-center text-[10px] px-2 py-[2px] rounded-full border font-semibold">
                                YB
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-white/70 mt-1">
                            {(biz.categoryLabel || biz.category || "Local spot")}
                          </div>
                          {biz.address ? (
                            <div className="text-xs text-white/60 mt-1">{biz.address}</div>
                          ) : null}
                          {biz.description ? (
                            <div className="text-sm text-white/80 mt-2 leading-snug">
                              {biz.description}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!filteredBusinesses.length ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                      No matches yet. Try another search term.
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                className={`lg:col-span-3 ${showMapMobile ? "block" : "hidden lg:block"}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-white/80">
                    {selectedBusiness ? `Selected: ${selectedBusiness.name}` : "Map view"}
                  </div>
                  {selectedBusiness ? (
                    selectedBusiness.source === "supabase_users" ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 p-1">
                        <button
                          type="button"
                          onClick={() => setActivePanel("map")}
                          className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                            activePanel === "map"
                              ? "bg-white text-black"
                              : "text-white hover:bg-white/10"
                          }`}
                        >
                          Map
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivePanel("listings")}
                          className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                            activePanel === "listings"
                              ? "bg-white text-black"
                              : "text-white hover:bg-white/10"
                          }`}
                        >
                          Listings
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-white/60">
                        Listings available for YourBarrio businesses
                      </span>
                    )
                  ) : null}
                </div>

                {activePanel === "listings" && selectedBusiness?.source === "supabase_users" ? (
                  <div className="h-[520px] rounded-2xl border border-white/10 bg-white/5 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-white/10">
                      <div className="text-sm font-semibold">{selectedBusiness.name}</div>
                      <div className="text-xs text-white/60">
                        Listings provided by this business
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
                ) : (
                  <GoogleMapClient
                    radiusKm={25}
                    showBusinessErrors={false}
                    containerClassName="w-full"
                    cardClassName="bg-transparent border-0 text-white"
                    mapClassName="h-[520px] rounded-2xl overflow-hidden border border-white/10"
                    title=""
                    enableCategoryFilter={false}
                    enableSearch={false}
                    onBusinessesChange={setMapBusinesses}
                    onControlsReady={setMapControls}
                    externalSearchTerm={search}
                    externalSearchTrigger={searchTrigger}
                  />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

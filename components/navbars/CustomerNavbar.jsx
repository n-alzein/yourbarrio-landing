"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import SafeImage from "@/components/SafeImage";
import {
  Bookmark,
  ChevronDown,
  Compass,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  PackageSearch,
  Search,
  Settings,
  Sparkles,
  Store,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "../ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import { useModal } from "../modals/ModalProvider";
import { fetchUnreadTotal } from "@/lib/messages";
import { resolveImageSrc } from "@/lib/safeImage";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import { BUSINESS_CATEGORIES } from "@/lib/businessCategories";
import {
  getAvailabilityBadgeStyle,
  normalizeInventory,
  sortListingsByAvailability,
} from "@/lib/inventory";

const SEARCH_CATEGORIES = ["All", ...BUSINESS_CATEGORIES];

const getInitialSearchTerm = (params) =>
  (params?.get("q") || "").trim();

const getInitialCategory = (params) => {
  const currentCategory = (params?.get("category") || "").trim();
  const matchedCategory = SEARCH_CATEGORIES.find(
    (category) => category.toLowerCase() === currentCategory.toLowerCase()
  );
  return matchedCategory || "All";
};

function NavItem({ href, children, badgeCount, badgeReady, active, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(href, "nav-item")}
      className={`w-full text-left text-sm md:text-base transition ${
        active ? "text-white font-semibold" : "text-white/70 hover:text-white"
      }`}
      data-nav-guard="1"
    >
      <span className="flex items-center gap-2">
        {children}
        {badgeReady && badgeCount > 0 ? (
          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            {badgeCount}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export default function CustomerNavbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = `${pathname}?${searchParams?.toString() || ""}`;
  return (
    <CustomerNavbarInner
      key={searchKey}
      pathname={pathname}
      searchParams={searchParams}
    />
  );
}

function CustomerNavbarInner({ pathname, searchParams }) {
  const router = useRouter();
  const { user, profile, loadingUser, supabase } = useAuth();
  const { theme, hydrated } = useTheme();
  const isLight = hydrated ? theme === "light" : true;
  const { openModal } = useModal();
  const [, startTransition] = useTransition();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => getInitialSearchTerm(searchParams));
  const [selectedCategory, setSelectedCategory] = useState(() => getInitialCategory(searchParams));
  const [searchResults, setSearchResults] = useState({
    items: [],
    businesses: [],
    places: [],
  });
  const sortedSearchItems = useMemo(
    () => sortListingsByAvailability(searchResults.items || []),
    [searchResults.items]
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const badgeReady = !loadingUser;
  const dropdownRef = useRef(null);
  const dropdownPanelRef = useRef(null);
  const searchBoxRef = useRef(null);
  const searchInputRef = useRef(null);
  const navSavedRef = useRef(null);
  const navSettingsRef = useRef(null);
  const searchRequestIdRef = useRef(0);
  const lastQueryRef = useRef("");
  // DEBUG_CLICK_DIAG / NAV_TRACE
  const clickDiagEnabled = process.env.NEXT_PUBLIC_CLICK_DIAG === "1";
  const diagClick = (label) => (event) => {
    if (!clickDiagEnabled) return;
    console.log("[CLICK_DIAG] REACT_ONCLICK", label, {
      defaultPrevented: event.defaultPrevented,
      target: event.target?.tagName,
      currentTarget: event.currentTarget?.tagName,
      pathname,
      profileMenuOpen,
      loadingUser,
      hasUser: !!user,
      hasProfile: !!profile,
      href: event.currentTarget?.getAttribute?.("href") || null,
    });
    queueMicrotask(() => {
      console.log("[CLICK_DIAG] REACT_ONCLICK_POST", { label, href: window.location.href });
    });
  };

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const isOpen = profileMenuOpen || mobileMenuOpen;
    document.documentElement.dataset.navMenuOpen = isOpen ? "1" : "0";
    return () => {
      delete document.documentElement.dataset.navMenuOpen;
    };
  }, [profileMenuOpen, mobileMenuOpen]);

  // DEBUG_CLICK_DIAG: trace search focus behavior on home
  useEffect(() => {
    if (!clickDiagEnabled || !pathname?.startsWith("/customer/home")) return undefined;
    const input = searchInputRef.current;
    if (!input) return undefined;
    const handler = (event) => {
      try {
        const { clientX, clientY } = event;
        const rect = input.getBoundingClientRect();
        setTimeout(() => {
          const active = document.activeElement === input;
          const topAtClick = document.elementFromPoint(clientX, clientY);
          const centerTop = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          const styles =
            topAtClick && typeof window !== "undefined"
              ? window.getComputedStyle(topAtClick)
              : null;
          console.log("[CLICK_DIAG] search focus check", {
            active,
            topAtClick: topAtClick?.className || topAtClick?.tagName,
            centerTop: centerTop?.className || centerTop?.tagName,
            styles: styles
              ? {
                  position: styles.position,
                  zIndex: styles.zIndex,
                  pointerEvents: styles.pointerEvents,
                  opacity: styles.opacity,
                  transform: styles.transform,
                }
              : null,
          });
        }, 50);
      } catch (err) {
        console.warn("[CLICK_DIAG] search focus check error", err);
      }
    };
    input.addEventListener("pointerdown", handler, { passive: true, capture: true });
    return () => {
      input.removeEventListener("pointerdown", handler, { passive: true, capture: true });
    };
  }, [clickDiagEnabled, pathname]);

  // DEBUG_CLICK_DIAG: global tracer on home to detect cancellations
  useEffect(() => {
    if (!clickDiagEnabled || !pathname?.startsWith("/customer/home")) return undefined;
    const logEventCapture = (event) => {
      try {
        console.log("[CLICK_DIAG] HOME_TRACE", {
          type: event.type,
          phase: "capture",
          defaultPrevented: event.defaultPrevented,
          cancelBubble: event.cancelBubble,
          target: event.target?.tagName,
          className: event.target?.className,
        });
      } catch {
        /* ignore */
      }
    };
    const logEventBubble = (event) => {
      try {
        console.log("[CLICK_DIAG] HOME_TRACE", {
          type: event.type,
          phase: "bubble",
          defaultPrevented: event.defaultPrevented,
          cancelBubble: event.cancelBubble,
          target: event.target?.tagName,
          className: event.target?.className,
        });
      } catch {
        /* ignore */
      }
    };
    const types = ["pointerdown", "click", "keydown"];
    types.forEach((t) => {
      document.addEventListener(t, logEventCapture, { capture: true, passive: true });
      document.addEventListener(t, logEventBubble, { passive: true });
    });
    return () => {
      types.forEach((t) => {
        document.removeEventListener(t, logEventCapture, { capture: true, passive: true });
        document.removeEventListener(t, logEventBubble, { passive: true });
      });
    };
  }, [clickDiagEnabled, pathname]);

  useEffect(() => {
    if (!clickDiagEnabled || !profileMenuOpen) return undefined;
    const panel = dropdownPanelRef.current;
    const navEl = dropdownRef.current;
    try {
      const panelRect = panel?.getBoundingClientRect();
      const navRect = navEl?.getBoundingClientRect();
      const samplePoint = panelRect
        ? { x: panelRect.left + 10, y: panelRect.top + 10 }
        : null;
      const topAtPanel = samplePoint
        ? document.elementFromPoint(samplePoint.x, samplePoint.y)
        : null;
      const zNav =
        navEl && typeof window !== "undefined"
          ? window.getComputedStyle(navEl).zIndex
          : null;
      const zPanel =
        panel && typeof window !== "undefined"
          ? window.getComputedStyle(panel).zIndex
          : null;
      console.log("[CLICK_DIAG] dropdown metrics", {
        navRect,
        panelRect,
        navZ: zNav,
        panelZ: zPanel,
        topAtPanel: topAtPanel?.className || topAtPanel?.tagName,
      });
    } catch (err) {
      console.warn("[CLICK_DIAG] dropdown metrics error", err);
    }
    return undefined;
  }, [clickDiagEnabled, profileMenuOpen]);

  // Hybrid search — fetch AI-style blend of items + businesses
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 3) {
      queueMicrotask(() => {
        setSearchResults({ items: [], businesses: [], places: [] });
        setSearchError(null);
        setSearchLoading(false);
        setSuggestionsOpen(false);
      });
      lastQueryRef.current = "";
      return;
    }

    const normalized = `${term.toLowerCase()}::${selectedCategory.toLowerCase()}`;
    if (normalized === lastQueryRef.current) {
      queueMicrotask(() => {
        setSuggestionsOpen(true);
      });
      return;
    }

    const controller = new AbortController();
    const requestId = ++searchRequestIdRef.current;

    const handle = setTimeout(() => {
      queueMicrotask(() => {
        setSearchLoading(true);
        setSearchError(null);
      });
      const categoryParam = selectedCategory !== "All" ? selectedCategory : "";
      const params = new URLSearchParams();
      params.set("q", term);
      if (categoryParam) params.set("category", categoryParam);
      fetch(`/api/search?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            let message = "search_failed";
            try {
              const body = await res.json();
              message = body?.message || body?.error || message;
            } catch {
              // best effort
            }
            const err = new Error(message);
            err.code = res.status;
            throw err;
          }
          return res.json();
        })
        .then((data) => {
          if (searchRequestIdRef.current !== requestId) return;
          lastQueryRef.current = normalized;
          setSearchResults({
            items: data?.items || [],
            businesses: data?.businesses || [],
            places: data?.places || [],
          });
          setSuggestionsOpen(true);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          console.warn("Navbar search failed", err);
          if (searchRequestIdRef.current !== requestId) return;
          const isRateLimited =
            err?.code === 429 || err?.message === "rate_limit_exceeded";
          setSearchError(
            isRateLimited
              ? "You are searching too fast. Please wait a moment."
              : err?.message || "Search is warming up. Try again in a moment."
          );
        })
        .finally(() => {
          if (searchRequestIdRef.current === requestId) {
            setSearchLoading(false);
          }
        });
    }, 450);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [searchTerm, selectedCategory]);

  // Close dropdown on outside click for a more premium, lightweight feel
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClick = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [profileMenuOpen]);

  // Close AI suggestions when clicking away
  useEffect(() => {
    if (!suggestionsOpen) return;
    const handleClick = (event) => {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(event.target)
      ) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [suggestionsOpen]);

  /* ---------------------------------------------------
     AVATAR PRIORITY
  --------------------------------------------------- */
  const googleAvatar = user?.user_metadata?.avatar_url || null;
  const hasAuth = Boolean(user);

  const avatar = resolveImageSrc(
    profile?.profile_photo_url?.trim() || googleAvatar || "",
    "/customer-placeholder.png"
  );

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    user?.user_metadata?.email ||
    "Account";

  const email =
    profile?.email ||
    user?.email ||
    user?.user_metadata?.email ||
    null;

  const isActive = (href) => pathname === href;

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const logNavDebug = (href, method) => {
    if (process.env.NODE_ENV === "production") return;
    if (href === "/customer/saved" || href === "/customer/settings") {
      console.info("[nav-debug]", { from: pathname, href, method });
    }
  };

  const handleNavigate = (href, method = "router.push") => {
    if (!href) return;
    logNavDebug(href, method);
    startTransition(() => {
      try {
        router.push(href);
      } catch (err) {
        console.error("[NAV_TRACE] router.push error", err);
        throw err;
      }
    });
  };

  // DEBUG_CLICK_DIAG
  useEffect(() => {
    if (!clickDiagEnabled) return undefined;
    const savedEl = navSavedRef.current;
    const settingsEl = navSettingsRef.current;
    if (savedEl) savedEl.dataset.clickdiagBound = "nav-saved";
    if (settingsEl) settingsEl.dataset.clickdiagBound = "nav-settings";
    return () => {
      if (savedEl) delete savedEl.dataset.clickdiagBound;
      if (settingsEl) delete settingsEl.dataset.clickdiagBound;
    };
  }, [clickDiagEnabled]);

  const handleNavCapture = (event) => {
    if (!clickDiagEnabled) return;
    console.log("[CLICK_DIAG] navbar capture", {
      target: event.target,
      currentTarget: event.currentTarget,
    });
  };

  const quickActions = [
    {
      href: "/customer/home",
      title: "Discover",
      description: "See what's buzzing near you",
      icon: Compass,
    },
    {
      href: "/customer/messages",
      title: "Messages",
      description: "Chat with local businesses",
      icon: MessageSquare,
      showBadge: true,
    },
    {
      href: "/customer/saved",
      title: "Saved items",
      description: "Instant access to your favorites",
      icon: Bookmark,
      diag: "nav-saved",
    },
  ];

  const hasHybridResults =
    (searchResults.items?.length || 0) +
      (searchResults.businesses?.length || 0) +
      (searchResults.places?.length || 0) >
    0;

  const navigateToSearch = (query, category) => {
    const value = (query || "").trim();
    const nextCategory = (category || "").trim();
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    if (nextCategory && nextCategory !== "All") params.set("category", nextCategory);
    const target = params.toString()
      ? `/customer/home?${params.toString()}`
      : "/customer/home";
    setSuggestionsOpen(false);
    router.push(target);
  };

  const handleSubmitSearch = (event) => {
    event.preventDefault();
    navigateToSearch(searchTerm || "", selectedCategory);
  };

  const handleCategoryChange = (event) => {
    const next = event.target.value;
    setSelectedCategory(next);
    navigateToSearch(searchTerm || "", next);
  };

  const handleSuggestionSelect = (value, itemId) => {
    const next = (value || "").trim();
    if (!next) return;
    setSearchTerm(next);
    setSuggestionsOpen(false);
    if (itemId) {
      hardNavigate(`/customer/listings/${itemId}`);
      return;
    }
    navigateToSearch(next, selectedCategory);
  };

  const categorySelectWidth = Math.max(selectedCategory.length, 3) + 6;

  const loadUnreadCount = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    try {
      const total = await fetchUnreadTotal({
        supabase,
        userId,
        role: "customer",
      });
      setUnreadCount(total);
    } catch (err) {
      console.warn("Failed to load unread messages", err);
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    if (!badgeReady) return;
    queueMicrotask(() => {
      loadUnreadCount();
    });
  }, [badgeReady, loadUnreadCount]);

  useEffect(() => {
    if (!badgeReady) return undefined;
    const userId = user?.id;
    if (!userId) return undefined;
    const client = supabase ?? getBrowserSupabaseClient();
    if (!client) return undefined;

    const channel = client
      .channel(`customer-unread-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `customer_id=eq.${userId}`,
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [badgeReady, user?.id, supabase, loadUnreadCount]);

  /* ---------------------------------------------------
     LOADING STATE
  --------------------------------------------------- */
  if (loadingUser && !user) {
    return (
      <nav
        className="fixed top-0 inset-x-0 z-[5000] h-16 bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-b border-white/10 theme-lock pointer-events-auto"
        data-nav-guard="1"
      />
    );
  }

  /* ---------------------------------------------------
     NAVBAR UI
  --------------------------------------------------- */
  return (
    <nav
      className="fixed top-0 inset-x-0 z-[5000] bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-b border-white/10 theme-lock pointer-events-auto"
      data-clickdiag={clickDiagEnabled ? "navbar" : undefined}
      onClickCapture={handleNavCapture}
      data-nav-guard="1"
    >
      <div className="w-full px-5 sm:px-6 md:px-8 lg:px-10 xl:px-14 flex items-center justify-between h-20 gap-6">
        <Link
          href="/customer/home"
          onClick={closeMenus}
          aria-label="Go to home"
          className="touch-manipulation"
        >
          <img
            src="/logo.png"
            className="h-34 w-auto cursor-pointer select-none"
            alt="YourBarrio"
          />
        </Link>

        <div className="hidden md:flex flex-1 justify-center">
          <div
            ref={searchBoxRef}
            className="w-full max-w-3xl relative"
          >
            <form
              onSubmit={handleSubmitSearch}
              className="flex flex-1 items-stretch rounded-2xl overflow-hidden border border-white/15 bg-white/10 backdrop-blur-lg shadow-lg shadow-purple-950/20"
            >
              <div className="hidden lg:flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/70 bg-white/5 border-r border-white/10">
                <label htmlFor="customer-search-category" className="sr-only">
                  Category
                </label>
                <div className="relative">
                  <select
                    id="customer-search-category"
                    value={selectedCategory}
                    onChange={handleCategoryChange}
                    style={{ width: `${categorySelectWidth}ch` }}
                    className="appearance-none bg-transparent pr-7 text-xs font-semibold uppercase tracking-[0.12em] text-white/80 focus:outline-none"
                  >
                    {SEARCH_CATEGORIES.map((category) => (
                      <option key={category} value={category} className="text-black">
                        {category}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 text-white/60" />
                </div>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                <input
                  id="customer-nav-search"
                  name="search"
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setSuggestionsOpen(hasHybridResults || searchTerm.trim().length > 0)}
                  className="w-full bg-transparent py-3 pl-11 pr-3 text-sm text-white placeholder:text-white/60 focus:outline-none"
                  placeholder="Search tacos, coffee, salons, groceries..."
                  type="search"
                />
              </div>
              <button
                type="submit"
                className="px-5 bg-white text-sm font-semibold text-black hover:bg-white/90 transition"
              >
                Search
              </button>
            </form>

            {suggestionsOpen && (searchLoading || searchError || hasHybridResults) && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50">
                <div className="rounded-2xl border border-white/10 bg-[#0b0618]/92 backdrop-blur-2xl shadow-xl shadow-purple-950/20 p-3 text-white">
                  {searchError ? (
                    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-rose-200 mb-2">
                      {searchError}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/60">
                        <PackageSearch className="h-4 w-4" />
                        Items
                        {searchLoading ? <Loader2 className="h-3 w-3 animate-spin text-white/60" /> : null}
                      </div>
                      <div className="space-y-2">
                        {sortedSearchItems.slice(0, 4).map((item) => {
                          const inventory = normalizeInventory(item);
                          const badgeStyle = getAvailabilityBadgeStyle(
                            inventory.availability,
                            isLight
                          );
                          return (
                          <button
                            key={`item-${item.id}`}
                            type="button"
                            onClick={() => handleSuggestionSelect(item.title, item.id)}
                            className="w-full text-left rounded-xl border border-white/10 bg-white/5 px-3 py-3 hover:border-white/30 hover:bg-white/10 transition flex items-start gap-3"
                          >
                            <div className="h-10 w-10 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-[11px] font-semibold text-white/80">
                              {item.category
                                ? item.category.slice(0, 3).toUpperCase()
                                : "AI"}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-semibold leading-snug">{item.title}</div>
                              <div className="text-[11px] text-white/60">
                                {item.category || "Local listing"}
                                {item.price ? ` · $${item.price}` : ""}
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
                            </div>
                          </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/60">
                        <Store className="h-4 w-4" />
                        Businesses & places
                      </div>
                      <div className="space-y-2">
                        {(searchResults.businesses || []).slice(0, 3).map((biz) => (
                          <button
                            key={`biz-${biz.id}`}
                            type="button"
                            onClick={() => handleSuggestionSelect(biz.name)}
                            className="w-full text-left rounded-xl border border-white/10 bg-white/5 px-3 py-3 hover:border-white/30 hover:bg-white/10 transition flex items-start gap-3"
                          >
                            <div className="h-10 w-10 rounded-lg bg-emerald-500/20 border border-emerald-200/30 flex items-center justify-center">
                              <Store className="h-4 w-4 text-emerald-200" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-semibold leading-snug">{biz.name}</div>
                              <div className="text-[11px] text-white/60">
                                {biz.category || "Local business"}
                                {biz.city ? ` · ${biz.city}` : ""}
                              </div>
                            </div>
                          </button>
                        ))}

                        {(searchResults.places || []).slice(0, 3).map((place) => (
                          <button
                            key={`place-${place.id}`}
                            type="button"
                            onClick={() => handleSuggestionSelect(place.name)}
                            className="w-full text-left rounded-xl border border-white/10 bg-white/5 px-3 py-3 hover:border-white/30 hover:bg-white/10 transition flex items-start gap-3"
                          >
                            <div className="h-10 w-10 rounded-lg bg-blue-500/20 border border-blue-200/30 flex items-center justify-center">
                              <MapPin className="h-4 w-4 text-blue-100" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-semibold leading-snug">{place.name}</div>
                              <div className="text-[11px] text-white/60">
                                {place.address || "Nearby result"}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — AUTH STATE */}
        <div className="hidden md:flex items-center gap-8">

          {!hasAuth && (
            <>
              <button
                type="button"
                onClick={() => openModal("customer-login")}
                className="text-sm md:text-base transition text-white/70 hover:text-white"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => openModal("customer-signup")}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 text-white font-semibold"
              >
                Sign Up
              </button>
            </>
          )}

          {hasAuth && (
            <div
              className="relative"
              ref={dropdownRef}
              data-clickdiag={clickDiagEnabled ? "dropdown" : undefined}
              data-nav-guard="1"
            >
              {profileMenuOpen ? (
                <button
                  type="button"
                  aria-label="Close profile menu"
                  className="fixed inset-0 z-[5050] cursor-default"
                  onClick={() => setProfileMenuOpen(false)}
                  data-nav-guard="1"
                />
              ) : null}
              <button
                onClick={() => setProfileMenuOpen((open) => !open)}
                data-clickdiag={clickDiagEnabled ? "navbar-user" : undefined}
                className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-1.5 backdrop-blur-sm border border-white/10 hover:border-white/30 transition"
              >
                <SafeImage
                  src={avatar}
                  alt="Profile avatar"
                  className="h-10 w-10 rounded-2xl object-cover border border-white/20"
                />
                <span className="hidden sm:block text-sm font-semibold text-white/90 max-w-[120px] truncate">
                  {displayName}
                </span>
                <ChevronDown className="h-4 w-4 text-white/70" />
              </button>

              {profileMenuOpen && (
                <div
                  className="absolute right-0 mt-4 w-80 rounded-3xl border border-white/15 bg-[#0d041c]/95 px-1.5 pb-3 pt-1.5 shadow-2xl shadow-purple-950/30 backdrop-blur-2xl z-[5100]"
                  data-clickdiag={clickDiagEnabled ? "dropdown" : undefined}
                  ref={dropdownPanelRef}
                  data-nav-guard="1"
                >
                  <div className="rounded-[26px] bg-gradient-to-br from-white/8 via-white/5 to-white/0">
                    <div className="flex items-center gap-3 px-4 py-4">
                      <SafeImage
                        src={avatar}
                        alt="Profile avatar"
                        className="h-12 w-12 rounded-2xl object-cover border border-white/20 shadow-inner shadow-black/50"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">{displayName}</p>
                        {email && (
                          <p className="text-xs text-white/60">{email}</p>
                        )}
                      </div>
                    </div>

                    <div className="px-2 pb-1 pt-2 space-y-1">
                      {quickActions.map(({ href, title, description, icon: Icon, diag, showBadge }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={(e) => {
                            if (clickDiagEnabled && e.defaultPrevented) {
                              console.warn("[CLICK_DIAG] nav link defaultPrevented", {
                                href,
                                stack: new Error().stack,
                              });
                            }
                            if (diag === "nav-saved") {
                              diagClick("NAV_SAVED_BUBBLE")(e);
                            }
                          }}
                          data-clickdiag={clickDiagEnabled ? diag || undefined : undefined}
                          data-clickdiag-bound={clickDiagEnabled && diag ? diag : undefined}
                          ref={diag === "nav-saved" ? navSavedRef : undefined}
                          onClickCapture={diag === "nav-saved" ? diagClick("NAV_SAVED_CAPTURE") : undefined}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/10 touch-manipulation text-left"
                          data-safe-nav="1"
                        >
                          <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-white/90">{title}</p>
                              {showBadge && badgeReady && unreadCount > 0 ? (
                                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                                  {unreadCount}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-white/60">{description}</p>
                          </div>
                        </Link>
                      ))}
                    </div>

                    <div className="mt-2 border-t border-white/10 px-4 pt-3">
                      <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                        <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                          Theme
                        </span>
                        <ThemeToggle
                          buttonClassName="px-2.5 py-1.5 text-[11px] font-medium text-white/70 border-white/10 bg-white/5 hover:bg-white/10"
                        />
                      </div>
                      <Link
                        href="/customer/settings"
                        onClick={(e) => {
                          if (clickDiagEnabled && e.defaultPrevented) {
                            console.warn("[CLICK_DIAG] nav link defaultPrevented", {
                              href: "/customer/settings",
                              stack: new Error().stack,
                            });
                          }
                          diagClick("NAV_SETTINGS_BUBBLE")(e);
                        }}
                        className="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10 touch-manipulation text-left"
                        data-clickdiag={clickDiagEnabled ? "nav-settings" : undefined}
                        data-clickdiag-bound={clickDiagEnabled ? "nav-settings" : undefined}
                        ref={navSettingsRef}
                        onClickCapture={diagClick("NAV_SETTINGS_CAPTURE")}
                        data-safe-nav="1"
                      >
                        <span className="flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Account settings
                        </span>
                      </Link>
                      <LogoutButton
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition hover:opacity-90"
                        onSuccess={closeMenus}
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </LogoutButton>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MOBILE MENU BUTTON */}
        <button
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="md:hidden text-white"
        >
          {mobileMenuOpen ? (
            <svg className="h-7 w-7" fill="none" stroke="currentColor">
              <path strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-7 w-7" fill="none" stroke="currentColor">
              <path strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      <div
        className="md:hidden px-5 sm:px-6 pt-2 pb-4 border-t border-white/10"
        data-nav-guard="1"
      >
        <form
          onSubmit={handleSubmitSearch}
          className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2 shadow-sm"
        >
          <Search className="h-4 w-4 text-white/70" />
          <input
            id="customer-nav-search-mobile"
            name="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-sm placeholder:text-white/60 focus:outline-none"
            placeholder="Search for anything nearby"
            type="search"
          />
          <button
            type="submit"
            className="px-3 py-1 rounded-lg bg-white text-xs font-semibold text-black"
          >
            Go
          </button>
        </form>
      </div>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div
          className="md:hidden bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-t border-white/10 px-6 py-5 flex flex-col gap-5 text-white"
          data-nav-guard="1"
        >
          {!hasAuth && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openModal("customer-login");
                }}
                className="text-left text-white/70 hover:text-white"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openModal("customer-signup");
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 rounded-xl text-center font-semibold"
              >
                Sign Up
              </button>
            </>
          )}

          {hasAuth && (
            <>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <SafeImage
                  src={avatar}
                  alt="Profile avatar"
                  className="h-11 w-11 rounded-2xl object-cover border border-white/20"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                  {email ? (
                    <p className="text-xs text-white/60 truncate">{email}</p>
                  ) : null}
                </div>
              </div>
              <NavItem
                href="/customer/home"
                active={isActive("/customer/home")}
                badgeReady={badgeReady}
                onNavigate={handleNavigate}
              >
                Discover
              </NavItem>
              <NavItem
                href="/customer/messages"
                badgeCount={unreadCount}
                active={isActive("/customer/messages")}
                badgeReady={badgeReady}
                onNavigate={handleNavigate}
              >
                Messages
              </NavItem>
              <NavItem
                href="/customer/saved"
                active={isActive("/customer/saved")}
                badgeReady={badgeReady}
                onNavigate={handleNavigate}
              >
                Saved items
              </NavItem>
              <NavItem
                href="/customer/settings"
                active={isActive("/customer/settings")}
                badgeReady={badgeReady}
                onNavigate={handleNavigate}
              >
                Account settings
              </NavItem>
            </>
          )}

          <ThemeToggle
            showLabel
            align="left"
            className="self-start"
            buttonClassName="px-2.5 py-1.5 text-[11px] font-medium text-white/70 border-white/10 bg-white/5 hover:bg-white/10"
          />

          {hasAuth ? <LogoutButton mobile /> : null}
        </div>
      )}
    </nav>
  );
}

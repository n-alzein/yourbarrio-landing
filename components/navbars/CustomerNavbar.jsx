"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Bookmark,
  ChevronDown,
  Compass,
  Loader2,
  LogOut,
  MapPin,
  PackageSearch,
  Search,
  Settings,
  Sparkles,
  Store,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "../ThemeToggle";
import { useModal } from "../modals/ModalProvider";

export default function CustomerNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, authUser, loadingUser } = useAuth();
  const { openModal } = useModal();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hydrated, setHydrated] = useState(typeof window !== "undefined");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState({
    items: [],
    businesses: [],
    places: [],
  });
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const searchBoxRef = useRef(null);
  const searchRequestIdRef = useRef(0);

  // ⭐ Hydration guard fixes frozen buttons
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Close menus when the route changes
  useEffect(() => {
    setProfileMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  // Keep the search bar in sync with the current URL query
  useEffect(() => {
    const currentQuery = searchParams?.get("q") || "";
    setSearchTerm(currentQuery);
  }, [searchParams]);

  // Hybrid search — fetch AI-style blend of items + businesses
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults({ items: [], businesses: [], places: [] });
      setSearchError(null);
      setSearchLoading(false);
      setSuggestionsOpen(false);
      return;
    }

    const controller = new AbortController();
    const requestId = ++searchRequestIdRef.current;

    const handle = setTimeout(() => {
      setSearchLoading(true);
      setSearchError(null);
      fetch(`/api/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error("search_failed");
          return res.json();
        })
        .then((data) => {
          if (searchRequestIdRef.current !== requestId) return;
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
          setSearchError("Search is warming up. Try again in a moment.");
        })
        .finally(() => {
          if (searchRequestIdRef.current === requestId) {
            setSearchLoading(false);
          }
        });
    }, 150);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [searchTerm]);

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

  if (!hydrated) return null;

  /* ---------------------------------------------------
     ⛔ DO NOT RENDER CUSTOMER NAV ON BUSINESS PAGES
  --------------------------------------------------- */
  if (
    pathname.startsWith("/business") ||
    pathname.startsWith("/business-auth")
  ) {
    return null;
  }

  /* ---------------------------------------------------
     AVATAR PRIORITY
  --------------------------------------------------- */
  const googleAvatar = authUser?.user_metadata?.avatar_url || null;

  const avatar =
    user?.profile_photo_url?.trim() ||
    googleAvatar ||
    "/customer-placeholder.png";

  const displayName =
    user?.full_name ||
    user?.authUser?.user_metadata?.full_name ||
    user?.authUser?.user_metadata?.name ||
    "Account";

  const email =
    user?.email ||
    user?.authUser?.email ||
    user?.authUser?.user_metadata?.email ||
    null;

  const isActive = (href) => pathname === href;

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const NavItem = ({ href, children }) => (
    <Link
      href={href}
      className={`text-sm md:text-base transition ${
        isActive(href)
          ? "text-white font-semibold"
          : "text-white/70 hover:text-white"
      }`}
      onClick={closeMenus}
    >
      {children}
    </Link>
  );

  const quickActions = [
    {
      href: "/customer/home",
      title: "Discover",
      description: "See what's buzzing near you",
      icon: Compass,
    },
    {
      href: "/customer/saved",
      title: "Saved spots",
      description: "Instant access to your favorites",
      icon: Bookmark,
    },
  ];

  const hasHybridResults =
    (searchResults.items?.length || 0) +
      (searchResults.businesses?.length || 0) +
      (searchResults.places?.length || 0) >
    0;

  const navigateToSearch = (query) => {
    const value = (query || "").trim();
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    closeMenus();
    setSuggestionsOpen(false);
    router.push(
      params.toString()
        ? `/customer/home?${params.toString()}`
        : "/customer/home"
    );
  };

  const handleSubmitSearch = (event) => {
    event.preventDefault();
    navigateToSearch(searchTerm || "");
  };

  const handleSuggestionSelect = (value, itemId) => {
    const next = (value || "").trim();
    if (!next) return;
    setSearchTerm(next);
    if (itemId) {
      closeMenus();
      setSuggestionsOpen(false);
      router.push(`/customer/listings/${itemId}`);
      return;
    }
    navigateToSearch(next);
  };

  /* ---------------------------------------------------
     LOADING STATE
  --------------------------------------------------- */
  if (loadingUser && !user && !authUser) {
    return (
      <nav className="fixed top-0 inset-x-0 z-50 h-16 bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-b border-white/10 theme-lock" />
    );
  }

  /* ---------------------------------------------------
     NAVBAR UI
  --------------------------------------------------- */
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-b border-white/10 theme-lock">
      <div className="max-w-7xl mx-auto px-8 flex items-center justify-between h-20">

        {/* LEFT GROUP — LOGO + SEARCH */}
        <div className="flex items-center gap-6 md:gap-10 flex-1">
          <Link href="/customer/home">
            <img
              src="/logo.png"
              className="h-34 w-auto cursor-pointer select-none"
              alt="YourBarrio"
            />
          </Link>

          <div
            ref={searchBoxRef}
            className="hidden md:flex flex-1 max-w-3xl relative"
          >
            <form
              onSubmit={handleSubmitSearch}
              className="flex flex-1 items-stretch rounded-2xl overflow-hidden border border-white/15 bg-white/10 backdrop-blur-lg shadow-lg shadow-purple-950/20"
            >
              <div className="hidden lg:flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/70 bg-white/5 border-r border-white/10">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10">YB</span>
                <span>All</span>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                <input
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
                        {(searchResults.items || []).slice(0, 4).map((item) => (
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
                            </div>
                          </button>
                        ))}
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
          <ThemeToggle />

          {!user && (
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

          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileMenuOpen((open) => !open)}
                className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-1.5 backdrop-blur-sm border border-white/10 hover:border-white/30 transition"
              >
                <Image
                  src={avatar}
                  alt="Profile avatar"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-2xl object-cover border border-white/20"
                />
                <span className="hidden sm:block text-sm font-semibold text-white/90 max-w-[120px] truncate">
                  {displayName}
                </span>
                <ChevronDown className="h-4 w-4 text-white/70" />
              </button>

              {profileMenuOpen && (
                <div
                  className="absolute right-0 mt-4 w-80 rounded-3xl border border-white/15 bg-[#0d041c]/95 px-1.5 pb-3 pt-1.5 shadow-2xl shadow-purple-950/30 backdrop-blur-2xl z-50"
                >
                  <div className="rounded-[26px] bg-gradient-to-br from-white/8 via-white/5 to-white/0">
                    <div className="flex items-center gap-3 px-4 py-4">
                      <Image
                        src={avatar}
                        alt="Profile avatar"
                        width={48}
                        height={48}
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
                      {quickActions.map(({ href, title, description, icon: Icon }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={closeMenus}
                          className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/10"
                        >
                          <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white/90">{title}</p>
                            <p className="text-xs text-white/60">{description}</p>
                          </div>
                        </Link>
                      ))}
                    </div>

                    <div className="mt-2 border-t border-white/10 px-4 pt-3">
                      <Link
                        href="/customer/settings"
                        onClick={closeMenus}
                        className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
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

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-gradient-to-r from-purple-950/80 via-purple-900/60 to-fuchsia-900/70 backdrop-blur-xl border-t border-white/10 px-6 py-5 flex flex-col gap-5 text-white">
          <form
            onSubmit={handleSubmitSearch}
            className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2 shadow-sm"
          >
            <Search className="h-4 w-4 text-white/70" />
            <input
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
          <ThemeToggle showLabel align="left" />

          {!user && (
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

          {user && (
            <>
              <NavItem href="/customer/settings">Settings</NavItem>

              <LogoutButton mobile />
            </>
          )}
        </div>
      )}
    </nav>
  );
}

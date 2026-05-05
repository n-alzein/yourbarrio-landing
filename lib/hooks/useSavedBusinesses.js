"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useModal } from "@/components/modals/ModalProvider";
import { setAuthIntent } from "@/lib/auth/authIntent";
import { getAuthedContext } from "@/lib/auth/getAuthedContext";
import { useCurrentAccountContext } from "@/lib/auth/useCurrentAccountContext";

export const SAVED_BUSINESSES_EVENT = "yb:saved-businesses-changed";
const PENDING_AUTH_ACTION_STORAGE_KEY = "yb:pendingAuthAction";

function readCachedIds(cacheKey) {
  if (typeof window === "undefined" || !cacheKey) return [];
  try {
    const raw = window.localStorage.getItem(cacheKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writePendingAuthAction(intent) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_AUTH_ACTION_STORAGE_KEY, JSON.stringify(intent));
  } catch {}
}

function readPendingAuthAction() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(PENDING_AUTH_ACTION_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function clearPendingAuthAction() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_AUTH_ACTION_STORAGE_KEY);
  } catch {}
}

function getCurrentPath(fallback = "/") {
  if (typeof window === "undefined") return fallback;
  return `${window.location.pathname}${window.location.search}`;
}

function normalizeComparablePath(path) {
  try {
    const url = new URL(path || "/", "https://yourbarrio.local");
    url.searchParams.delete("yb_auth_handoff");
    url.searchParams.delete("yb_auth_fresh");
    return `${url.pathname}${url.search}`;
  } catch {
    return path || "/";
  }
}

function normalizeBusinessId(input) {
  if (!input) return "";
  if (typeof input === "string") return input.trim();
  return String(input.business_row_id || input.businessId || input.id || "").trim();
}

export function useSavedBusinesses({ autoSavePending = true } = {}) {
  const { authStatus, user } = useAuth();
  const { openModal } = useModal();
  const accountContext = useCurrentAccountContext();
  const cacheKey = user?.id ? `yb_saved_businesses_${user.id}` : null;
  const hasAuthedUser = authStatus === "authenticated" && Boolean(user?.id);
  const showSaveControls = !accountContext.isBusiness && !accountContext.rolePending;
  const [savedBusinessIds, setSavedBusinessIds] = useState(() => new Set(readCachedIds(cacheKey)));
  const [savingBusinessIds, setSavingBusinessIds] = useState(() => new Set());
  const autoSaveStartedRef = useRef(false);

  const persistSavedBusinessIds = useCallback(
    (ids) => {
      if (typeof window === "undefined") return;
      const values = Array.from(ids).filter(Boolean);
      if (cacheKey) {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(values));
        } catch {}
      }
      window.dispatchEvent(
        new CustomEvent(SAVED_BUSINESSES_EVENT, {
          detail: { ids: values },
        })
      );
    },
    [cacheKey]
  );

  useEffect(() => {
    if (!cacheKey || !showSaveControls) {
      setSavedBusinessIds(new Set());
      return;
    }
    setSavedBusinessIds(new Set(readCachedIds(cacheKey)));
  }, [cacheKey, showSaveControls]);

  useEffect(() => {
    let active = true;
    const loadSavedBusinesses = async () => {
      if (!hasAuthedUser || !showSaveControls) return;
      try {
        const { client, userId } = await getAuthedContext("loadSavedBusinesses");
        const { data, error } = await client
          .from("saved_businesses")
          .select("business_id")
          .eq("user_id", userId);
        if (error) throw error;
        if (!active) return;
        const ids = (data || []).map((row) => row.business_id).filter(Boolean);
        setSavedBusinessIds(new Set(ids));
        persistSavedBusinessIds(new Set(ids));
      } catch (err) {
        console.warn("Failed to load saved businesses", err);
      }
    };

    loadSavedBusinesses();
    return () => {
      active = false;
    };
  }, [hasAuthedUser, persistSavedBusinessIds, showSaveControls]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncSavedBusinesses = (ids) => {
      if (Array.isArray(ids)) setSavedBusinessIds(new Set(ids.filter(Boolean)));
    };
    const onSavedBusinessesChanged = (event) => {
      syncSavedBusinesses(event?.detail?.ids);
    };
    const onStorage = (event) => {
      if (!cacheKey || event.key !== cacheKey) return;
      try {
        const parsed = event.newValue ? JSON.parse(event.newValue) : [];
        syncSavedBusinesses(parsed);
      } catch {
        syncSavedBusinesses([]);
      }
    };
    window.addEventListener(SAVED_BUSINESSES_EVENT, onSavedBusinessesChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SAVED_BUSINESSES_EVENT, onSavedBusinessesChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [cacheKey]);

  const toggleSavedBusiness = useCallback(
    async (business, options = {}) => {
      const businessId = normalizeBusinessId(business);
      if (!businessId || !showSaveControls) return;

      if (!hasAuthedUser) {
        const currentPath = getCurrentPath(options.fallbackPath || "/customer/nearby");
        setAuthIntent({ redirectTo: currentPath, role: "customer" });
        writePendingAuthAction({
          type: "save_business",
          pathname: currentPath,
          businessId,
          businessSlug: options.businessSlug || business?.public_id || null,
        });
        openModal("customer-login", { next: currentPath });
        return;
      }

      const wasSaved = savedBusinessIds.has(businessId);
      const optimistic = new Set(savedBusinessIds);
      if (wasSaved) optimistic.delete(businessId);
      else optimistic.add(businessId);
      setSavedBusinessIds(optimistic);
      persistSavedBusinessIds(optimistic);
      setSavingBusinessIds((prev) => new Set(prev).add(businessId));

      try {
        const response = await fetch("/api/customer/saved-businesses", {
          method: wasSaved ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ businessId }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Save shop update failed");
        }
        setSavedBusinessIds(optimistic);
        persistSavedBusinessIds(optimistic);
      } catch (err) {
        console.error("Save shop toggle failed", err);
        setSavedBusinessIds(savedBusinessIds);
        persistSavedBusinessIds(savedBusinessIds);
      } finally {
        setSavingBusinessIds((prev) => {
          const next = new Set(prev);
          next.delete(businessId);
          return next;
        });
      }
    },
    [hasAuthedUser, openModal, persistSavedBusinessIds, savedBusinessIds, showSaveControls]
  );

  useEffect(() => {
    if (!autoSavePending || autoSaveStartedRef.current || !hasAuthedUser || !showSaveControls) return;
    const pending = readPendingAuthAction();
    if (pending?.type !== "save_business" || !pending?.businessId) return;
    const currentPath = getCurrentPath();
    if (
      pending.pathname &&
      normalizeComparablePath(pending.pathname) !== normalizeComparablePath(currentPath)
    ) {
      return;
    }
    autoSaveStartedRef.current = true;
    clearPendingAuthAction();
    if (!savedBusinessIds.has(pending.businessId)) {
      toggleSavedBusiness(pending.businessId);
    }
  }, [autoSavePending, hasAuthedUser, savedBusinessIds, showSaveControls, toggleSavedBusiness]);

  return {
    savedBusinessIds,
    savingBusinessIds,
    showSaveControls,
    toggleSavedBusiness,
  };
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import { discardTemporaryImages } from "@/lib/images/tempMediaClient";
import { revokeLocalPhotoDraftUrls } from "@/lib/listingPhotoDrafts";

export const LISTING_CREATE_DISCARD_MESSAGE =
  "Discard this unsaved listing and any pending photo uploads?";

function getSameOriginHref(anchor) {
  if (!anchor?.href) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next === current) return null;
  return next;
}

export async function discardPendingListingMedia({
  photos = [],
  uploadSessionId = null,
  discardTemp = discardTemporaryImages,
  abortPending = null,
}) {
  abortPending?.();
  const assetIds = photos.map((photo) => photo?.tempUpload?.assetId).filter(Boolean);
  if (assetIds.length || uploadSessionId) {
    await discardTemp({ assetIds, uploadSessionId }).catch((error) => {
      console.warn("[listing.photo] discard_temp_failed", {
        message: error?.message || String(error),
      });
    });
  }
  revokeLocalPhotoDraftUrls(photos);
}

export function useUnsavedListingCreateGuard({
  enabled,
  photos,
  uploadSessionId,
  router,
  confirmMessage = LISTING_CREATE_DISCARD_MESSAGE,
  abortPending,
  onDiscarded,
}) {
  const stateRef = useRef({
    enabled,
    photos,
    uploadSessionId,
    abortPending,
    onDiscarded,
  });
  const bypassRef = useRef(false);
  const hasHistorySentinelRef = useRef(false);

  useEffect(() => {
    stateRef.current = {
      enabled,
      photos,
      uploadSessionId,
      abortPending,
      onDiscarded,
    };
  }, [abortPending, enabled, onDiscarded, photos, uploadSessionId]);

  const confirmAndDiscard = useCallback(async () => {
    const state = stateRef.current;
    if (!state.enabled) return true;
    if (!window.confirm(confirmMessage)) return false;
    await discardPendingListingMedia({
      photos: state.photos,
      uploadSessionId: state.uploadSessionId,
      abortPending: state.abortPending,
    });
    state.onDiscarded?.();
    bypassRef.current = true;
    return true;
  }, [confirmMessage]);

  const navigateWithGuard = useCallback(
    async (href) => {
      const ok = await confirmAndDiscard();
      if (!ok) return false;
      router.push(href);
      return true;
    },
    [confirmAndDiscard, router]
  );

  useEffect(() => {
    function handleClick(event) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
      const anchor = event.target?.closest?.("a[href]");
      const href = getSameOriginHref(anchor);
      if (!href || !stateRef.current.enabled || bypassRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      void navigateWithGuard(href);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [navigateWithGuard]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!stateRef.current.enabled || bypassRef.current) return undefined;
      event.preventDefault();
      event.returnValue = "";
      return "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (enabled && !hasHistorySentinelRef.current) {
      window.history.pushState(
        { ...(window.history.state || {}), listingCreateGuard: true },
        "",
        window.location.href
      );
      hasHistorySentinelRef.current = true;
    }
  }, [enabled]);

  useEffect(() => {
    async function handlePopState() {
      if (!stateRef.current.enabled || bypassRef.current) return;
      const ok = await confirmAndDiscard();
      if (ok) {
        hasHistorySentinelRef.current = false;
        window.history.back();
      } else {
        window.history.pushState(
          { ...(window.history.state || {}), listingCreateGuard: true },
          "",
          window.location.href
        );
        hasHistorySentinelRef.current = true;
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [confirmAndDiscard]);

  const markNavigationSafe = useCallback(() => {
    bypassRef.current = true;
  }, []);

  return { navigateWithGuard, confirmAndDiscard, markNavigationSafe };
}

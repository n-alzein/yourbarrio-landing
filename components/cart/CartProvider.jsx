"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

/** @typedef {import("@/lib/types/cart").CartResponse} CartResponse */

const CartContext = createContext({
  cart: null,
  vendor: null,
  items: [],
  itemCount: 0,
  loading: false,
  error: null,
  refreshCart: async () => {},
  addItem: async () => ({}),
  updateItem: async () => ({}),
  removeItem: async () => ({}),
  setFulfillmentType: async () => ({}),
  clearCart: async () => ({}),
});

/**
 * @param {Response} response
 * @returns {Promise<CartResponse>}
 */
async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function CartProvider({ children }) {
  const { user, authStatus } = useAuth();
  const [cart, setCart] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inFlightRef = useRef(false);
  const abortRef = useRef(null);
  const lastRefreshKeyRef = useRef(null);

  const syncCart = useCallback((payload) => {
    setCart(payload?.cart || null);
    setVendor(payload?.vendor || null);
    setItems(payload?.cart?.cart_items || []);
  }, []);

  const refreshCart = useCallback(
    async ({ reason } = {}) => {
      if (!user?.id || authStatus !== "authenticated") {
        setCart(null);
        setVendor(null);
        setItems([]);
        setLoading(false);
        setError(null);
        return { cart: null };
      }

      if (inFlightRef.current) return { skipped: true };
      inFlightRef.current = true;

      if (abortRef.current?.abort) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      if (process.env.NEXT_PUBLIC_DEBUG_NAV_PERF === "1") {
        console.log("[cart] refresh:start", { reason });
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/cart", {
          method: "GET",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const payload = await parseResponse(response);
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load cart");
        }
        syncCart(payload);
        return payload;
      } catch (err) {
        if (process.env.NEXT_PUBLIC_DEBUG_NAV_PERF === "1") {
          console.log("[cart] refresh:error", { message: err?.message || String(err) });
        }
        setError(err?.message || "Failed to load cart");
        return { error: err?.message || "Failed to load cart" };
      } finally {
        setLoading(false);
        inFlightRef.current = false;
      }
    },
    [authStatus, syncCart, user?.id]
  );

  useEffect(() => {
    if (!user?.id || authStatus !== "authenticated") return undefined;
    const key = `${user.id}:${authStatus}`;
    if (lastRefreshKeyRef.current === key) return undefined;
    lastRefreshKeyRef.current = key;
    refreshCart({ reason: "mount" });
    return () => {
      if (abortRef.current?.abort) {
        abortRef.current.abort();
      }
    };
  }, [authStatus, refreshCart, user?.id]);

  const addItem = useCallback(
    async ({ listingId, quantity = 1, clearExisting }) => {
      if (!user?.id) {
        return { error: "Please log in to add items." };
      }

      setError(null);
      const response = await fetch("/api/cart", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          quantity,
          clear_existing: clearExisting,
        }),
      });

      const payload = await parseResponse(response);
      if (!response.ok) {
        if (response.status === 409) {
          return { conflict: true, ...payload };
        }
        return { error: payload?.error || "Failed to add to cart" };
      }

      syncCart(payload);
      return { cart: payload?.cart || null, vendor: payload?.vendor || null };
    },
    [syncCart, user?.id]
  );

  const updateItem = useCallback(
    async ({ itemId, quantity }) => {
      if (!user?.id) {
        return { error: "Please log in." };
      }

      const response = await fetch("/api/cart", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, quantity }),
      });

      const payload = await parseResponse(response);
      if (!response.ok) {
        return { error: payload?.error || "Failed to update cart" };
      }

      syncCart(payload);
      return payload;
    },
    [syncCart, user?.id]
  );

  const removeItem = useCallback(
    async (itemId) => updateItem({ itemId, quantity: 0 }),
    [updateItem]
  );

  const setFulfillmentType = useCallback(
    async (fulfillmentType) => {
      if (!user?.id) {
        return { error: "Please log in." };
      }

      const response = await fetch("/api/cart", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfillment_type: fulfillmentType }),
      });

      const payload = await parseResponse(response);
      if (!response.ok) {
        return { error: payload?.error || "Failed to update fulfillment" };
      }

      syncCart(payload);
      return payload;
    },
    [syncCart, user?.id]
  );

  const clearCart = useCallback(async () => {
    if (!user?.id) {
      return { error: "Please log in." };
    }

    const response = await fetch("/api/cart", {
      method: "DELETE",
      credentials: "include",
    });

    const payload = await parseResponse(response);
    if (!response.ok) {
      return { error: payload?.error || "Failed to clear cart" };
    }

    syncCart(payload);
    return payload;
  }, [syncCart, user?.id]);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [items]
  );

  const value = useMemo(
    () => ({
      cart,
      vendor,
      items,
      itemCount,
      loading,
      error,
      refreshCart,
      addItem,
      updateItem,
      removeItem,
      setFulfillmentType,
      clearCart,
    }),
    [
      cart,
      vendor,
      items,
      itemCount,
      loading,
      error,
      refreshCart,
      addItem,
      updateItem,
      removeItem,
      setFulfillmentType,
      clearCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}

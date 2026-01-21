"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ShoppingBag, Trash2, Truck, Minus, Plus } from "lucide-react";
import SafeImage from "@/components/SafeImage";
import { useCart } from "@/components/cart/CartProvider";

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function CartPage() {
  const { cart, vendor, items, loading, error, updateItem, removeItem, setFulfillmentType } = useCart();
  const [updatingItem, setUpdatingItem] = useState(null);
  const [fulfillmentError, setFulfillmentError] = useState(null);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0),
    [items]
  );
  const fees = 0;
  const total = subtotal + fees;

  const handleQuantityChange = async (item, delta) => {
    const nextQuantity = Number(item.quantity || 0) + delta;
    setUpdatingItem(item.id);
    if (nextQuantity <= 0) {
      await removeItem(item.id);
    } else {
      await updateItem({ itemId: item.id, quantity: nextQuantity });
    }
    setUpdatingItem(null);
  };

  const handleFulfillmentChange = async (mode) => {
    setFulfillmentError(null);
    const result = await setFulfillmentType(mode);
    if (result?.error) {
      setFulfillmentError(result.error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen px-4 md:px-8 lg:px-12 py-12" style={{ background: "var(--background)", color: "var(--text)" }}>
        <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
          <div className="h-6 w-40 rounded-full" style={{ background: "var(--surface)" }} />
          <div className="h-64 rounded-3xl" style={{ background: "var(--surface)" }} />
        </div>
      </div>
    );
  }

  if (!cart || items.length === 0) {
    return (
      <div className="min-h-screen px-4 md:px-8 lg:px-12 py-12" style={{ background: "var(--background)", color: "var(--text)" }}>
        <div className="max-w-4xl mx-auto rounded-3xl p-8 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h1 className="text-2xl font-semibold">Your cart is empty</h1>
          <p className="mt-3 text-sm opacity-80">Add items from a local listing to start an order request.</p>
          <Link
            href="/customer/home"
            className="mt-6 inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold"
            style={{ background: "var(--text)", color: "var(--background)" }}
          >
            Browse listings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-12 py-12" style={{ background: "var(--background)", color: "var(--text)" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] opacity-70">Cart</p>
          <h1 className="text-3xl font-semibold">Review your order</h1>
          {vendor ? (
            <p className="text-sm opacity-80">Vendor: {vendor.business_name || vendor.full_name || "Local vendor"}</p>
          ) : null}
          {error ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : null}
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <div className="space-y-4">
            <div className="rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Fulfillment</p>
                {cart.fulfillment_locked ? (
                  <span className="text-xs opacity-70">Locked by request</span>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleFulfillmentChange("delivery")}
                  disabled={cart.fulfillment_locked}
                  className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
                    cart.fulfillment_type === "delivery" ? "ring-2 ring-indigo-500/40" : ""
                  }`}
                  style={{ background: "var(--overlay)", border: "1px solid var(--border)" }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Truck className="h-4 w-4" /> Delivery
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFulfillmentChange("pickup")}
                  disabled={cart.fulfillment_locked}
                  className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
                    cart.fulfillment_type === "pickup" ? "ring-2 ring-indigo-500/40" : ""
                  }`}
                  style={{ background: "var(--overlay)", border: "1px solid var(--border)" }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <ShoppingBag className="h-4 w-4" /> Pickup
                  </span>
                </button>
              </div>
              {fulfillmentError ? (
                <p className="mt-3 text-xs text-rose-200">{fulfillmentError}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl p-4 flex flex-col gap-4 sm:flex-row sm:items-center"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <SafeImage
                      src={item.image_url || "/business-placeholder.png"}
                      alt={item.title}
                      width={96}
                      height={96}
                      className="h-20 w-20 rounded-2xl object-cover"
                      useNextImage
                    />
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs opacity-70">${formatMoney(item.unit_price)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-full px-2 py-1" style={{ background: "var(--overlay)", border: "1px solid var(--border)" }}>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item, -1)}
                        disabled={updatingItem === item.id}
                        className="p-1"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[24px] text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item, 1)}
                        disabled={updatingItem === item.id}
                        className="p-1"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded-full p-2 text-rose-200 hover:text-rose-100"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold">Order summary</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="opacity-80">Subtotal</span>
                  <span>${formatMoney(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="opacity-80">Fees</span>
                  <span>${formatMoney(fees)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-sm font-semibold">${formatMoney(total)}</span>
                </div>
              </div>
              <Link
                href="/checkout"
                className="mt-5 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold"
                style={{ background: "var(--text)", color: "var(--background)" }}
              >
                Checkout
              </Link>
              <p className="mt-3 text-xs opacity-70">Payment collected at pickup/delivery.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

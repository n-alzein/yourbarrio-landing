"use client";

import { useState } from "react";
import { buildVariantLabel } from "@/lib/listingOptions";

function getNormalizedBasePrice(basePrice) {
  const parsed = Number(basePrice);
  if (!Number.isFinite(parsed) || parsed < 0.01) return null;
  return Number(parsed.toFixed(2));
}

export default function VariantMatrix({ variants, onChange, errors, basePrice = null }) {
  const normalizedBasePrice = getNormalizedBasePrice(basePrice);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasSkuValues = variants.some((variant) => (variant?.sku || "").trim().length > 0);

  const initializePriceOverride = (variant, index) => {
    if (variant?.price !== null && variant?.price !== undefined && variant?.price !== "") {
      return;
    }
    if (normalizedBasePrice === null) return;
    onChange(index, {
      ...variant,
      price: normalizedBasePrice,
    });
  };

  if (!Array.isArray(variants) || variants.length === 0) {
    return (
      <div className="px-1 py-2 text-sm text-slate-500">
        Add at least one choice to each option and your variants will appear here automatically.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`hidden gap-3 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 md:grid md:grid-cols-[minmax(0,1.4fr)_104px_minmax(140px,176px)] ${showAdvanced ? "" : "[&_[data-sku-column]]:hidden"}`}>
        <span>Variant</span>
        <span>Qty</span>
        <span>Price</span>
      </div>
      <div className={`space-y-2 ${showAdvanced ? "" : "[&_[data-sku-column]]:hidden"}`}>
        <div className="sr-only">
          Optional. Used for your internal tracking.
        </div>
        {variants.map((variant, index) => {
          const label = buildVariantLabel(variant.options) || `Variant ${index + 1}`;
          const variantErrors = errors?.[index] || {};
          return (
            <div
              key={variant.id || `${label}-${index}`}
              className="border-b border-slate-100 px-1 py-2 last:border-b-0"
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_104px_minmax(140px,176px)] md:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  {variantErrors.options ? (
                    <p className="mt-1 text-xs text-rose-600">{variantErrors.options}</p>
                  ) : null}
                </div>

                <label className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400 md:sr-only">
                    Qty
                  </span>
                  <input
                    type="number"
                    min="0"
                    aria-label={`Quantity for ${label}`}
                    className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    placeholder="Qty"
                    value={variant.quantity}
                    onChange={(event) =>
                      onChange(index, {
                        ...variant,
                        quantity: event.target.value,
                      })
                    }
                  />
                  {variantErrors.quantity ? (
                    <p className="text-xs text-rose-600">{variantErrors.quantity}</p>
                  ) : null}
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400 md:sr-only">
                    Price
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    aria-label={`Price override for ${label}`}
                    className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    value={variant.price ?? ""}
                    placeholder="Use base price"
                    onFocus={() => initializePriceOverride(variant, index)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                        initializePriceOverride(variant, index);
                      }
                    }}
                    onChange={(event) =>
                      onChange(index, {
                        ...variant,
                        price: event.target.value,
                      })
                    }
                  />
                  {variantErrors.price ? (
                    <p className="text-xs text-rose-600">{variantErrors.price}</p>
                  ) : null}
                </label>
              </div>

              <label className="mt-2 block space-y-1" data-sku-column>
                <span className="sr-only">SKU</span>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                  <input
                    aria-label={`SKU for ${label}`}
                    className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    value={variant.sku || ""}
                    placeholder="Optional"
                    onChange={(event) =>
                      onChange(index, {
                        ...variant,
                        sku: event.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-slate-500">
                    Optional. Used for your internal tracking.
                  </p>
                </div>
              </label>
            </div>
          );
        })}
      </div>
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
          className="text-xs font-medium text-slate-500 transition hover:text-slate-900"
        >
          {showAdvanced || hasSkuValues ? "Hide SKU" : "Add SKU"}
        </button>
      </div>
    </div>
  );
}

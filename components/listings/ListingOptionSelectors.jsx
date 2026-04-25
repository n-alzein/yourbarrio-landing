"use client";

import { getSelectableVariantValueState } from "@/lib/listingOptions";

export default function ListingOptionSelectors({
  attributes,
  variants,
  selectedOptions,
  onChange,
}) {
  const availability = getSelectableVariantValueState(attributes, variants, selectedOptions);
  const list = Array.isArray(attributes) ? attributes : [];

  if (!list.length) return null;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          Options
        </h3>
        <p className="mt-2 text-xs opacity-65">
          Select each option before adding this item to your cart.
        </p>
      </div>

      <div>
        {list.map((attribute, index) => (
          <div
            key={attribute.id || attribute.name}
            className={index === 0 ? "mt-5" : "mt-7"}
          >
            <label className="block text-xs font-medium tracking-[0.04em] opacity-70">
              {attribute.name}
            </label>
            <div className="mt-3 flex flex-wrap gap-3">
              {(Array.isArray(attribute.values) ? attribute.values : []).map((valueRow) => {
                const active = selectedOptions?.[attribute.name] === valueRow.value;
                const enabled = availability?.[attribute.name]?.[valueRow.value] !== false;

                return (
                  <button
                    key={valueRow.id || `${attribute.name}-${valueRow.value}`}
                    type="button"
                    disabled={!enabled}
                    onClick={() => onChange?.(attribute.name, valueRow.value)}
                    className={`min-h-11 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                      !enabled ? "cursor-not-allowed" : ""
                    }`}
                    style={{
                      background: active ? "rgba(124,58,237,0.10)" : "rgba(15,23,42,0.03)",
                      border: active
                        ? "1px solid rgba(124,58,237,0.22)"
                        : "1px solid rgba(15,23,42,0.08)",
                      color: active ? "rgb(91,33,182)" : "var(--text)",
                      opacity: enabled ? 1 : 0.45,
                    }}
                  >
                    {valueRow.value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

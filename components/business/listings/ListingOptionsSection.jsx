"use client";

import { useEffect, useMemo, useRef } from "react";
import { Plus } from "lucide-react";
import AttributeEditor from "@/components/business/listings/AttributeEditor";
import VariantMatrix from "@/components/business/listings/VariantMatrix";
import {
  createEmptyAttribute,
  createEmptyVariantPayload,
  normalizeListingOptionsPayload,
  syncVariantsWithGeneratedCombinations,
} from "@/lib/listingOptions";

function getVariantSignature(variants) {
  return JSON.stringify(
    (Array.isArray(variants) ? variants : []).map((variant) => ({
      id: variant?.id || null,
      sku: variant?.sku || "",
      price: variant?.price ?? null,
      quantity: variant?.quantity ?? 0,
      is_active: variant?.is_active !== false,
      options: variant?.options || {},
    }))
  );
}

export default function ListingOptionsSection({
  value,
  onChange,
  errors,
  onBeforeDisable,
  basePrice = null,
  className = "",
}) {
  const state = useMemo(() => {
    const normalizedState = normalizeListingOptionsPayload(value || createEmptyVariantPayload());
    return {
      ...normalizedState,
      attributes: normalizedState.attributes.map((attribute) => ({
        ...attribute,
        required: true,
      })),
    };
  }, [value]);
  const lastAutoSyncSignatureRef = useRef("");

  const updateState = (nextState) => {
    const nextAttributes = Array.isArray(nextState?.attributes)
      ? nextState.attributes.map((attribute) => ({
          ...attribute,
          required: true,
        }))
      : state.attributes.map((attribute) => ({
          ...attribute,
          required: true,
        }));
    onChange?.({
      ...state,
      ...nextState,
      attributes: nextAttributes,
    });
  };

  const toggleOptions = (checked) => {
    if (!checked) {
      const shouldDisable = onBeforeDisable ? onBeforeDisable(state) : true;
      if (!shouldDisable) return;
      onChange?.(createEmptyVariantPayload());
      return;
    }
    onChange?.({
      hasOptions: true,
      attributes: state.attributes.length
        ? state.attributes.map((attribute) => ({ ...attribute, required: true }))
        : [{ ...createEmptyAttribute(), required: true }],
      variants: syncVariantsWithGeneratedCombinations(
        state.attributes.length
          ? state.attributes.map((attribute) => ({ ...attribute, required: true }))
          : [{ ...createEmptyAttribute(), required: true }],
        state.variants
      ),
    });
  };

  useEffect(() => {
    if (!state.hasOptions) return;
    const nextVariants = syncVariantsWithGeneratedCombinations(state.attributes, state.variants);
    const currentSignature = getVariantSignature(state.variants);
    const nextSignature = getVariantSignature(nextVariants);
    if (currentSignature === nextSignature) {
      lastAutoSyncSignatureRef.current = nextSignature;
      return;
    }
    if (lastAutoSyncSignatureRef.current === nextSignature) return;
    lastAutoSyncSignatureRef.current = nextSignature;
    onChange?.({
      ...state,
      variants: nextVariants,
    });
  }, [onChange, state]);

  const hasOptionsConfigured = state.attributes.length > 0;

  return (
    <section className={className}>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Product options</h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Use options like size or color when shoppers need to choose a version of this product.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-500"
              checked={state.hasOptions}
              onChange={(event) => toggleOptions(event.target.checked)}
            />
            This product has options
          </label>
        </div>

        {state.hasOptions ? (
          <div className="space-y-8 border-t border-slate-100 pt-6">
            {errors?.form?.length ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errors.form[0]}
              </div>
            ) : null}

            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">Option setup</h3>
                  <p className="text-sm text-slate-500">
                    Add the option groups and choices shoppers can mix and match.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateState({
                      attributes: [...state.attributes, createEmptyAttribute()],
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-400 hover:text-slate-900"
                >
                  <Plus className="h-4 w-4" />
                  Add option
                </button>
              </div>

              <div className="space-y-6">
                {state.attributes.map((attribute, attributeIndex) => (
                  <AttributeEditor
                    key={attribute.id || `attribute-${attributeIndex}`}
                    attribute={attribute}
                    index={attributeIndex}
                    errors={errors?.attributes?.[attributeIndex]}
                    onChange={(nextAttribute) => {
                      const nextAttributes = [...state.attributes];
                      nextAttributes[attributeIndex] = nextAttribute;
                      updateState({ attributes: nextAttributes });
                    }}
                    onRemove={() =>
                      updateState({
                        attributes: state.attributes.filter((_, index) => index !== attributeIndex),
                      })
                    }
                    onAddValue={(value) => {
                      const nextAttributes = [...state.attributes];
                      nextAttributes[attributeIndex] = {
                        ...attribute,
                        values: [...(attribute.values || []), { id: undefined, value }],
                      };
                      updateState({ attributes: nextAttributes });
                    }}
                    onRemoveValue={(valueIndex) => {
                      const nextAttributes = [...state.attributes];
                      nextAttributes[attributeIndex] = {
                        ...attribute,
                        values: (attribute.values || []).filter((_, index) => index !== valueIndex),
                      };
                      updateState({ attributes: nextAttributes });
                    }}
                  />
                ))}
              </div>
            </div>

            {hasOptionsConfigured ? (
              <div className="space-y-4 border-t border-slate-100 pt-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">Variant inventory</h3>
                  <p className="text-sm text-slate-500">
                    Set quantity and any optional price overrides for each generated variant.
                  </p>
                </div>
                <VariantMatrix
                  variants={state.variants}
                  errors={errors?.variants}
                  basePrice={basePrice}
                  onChange={(variantIndex, nextVariant) => {
                    const nextVariants = [...state.variants];
                    nextVariants[variantIndex] = nextVariant;
                    updateState({ variants: nextVariants });
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

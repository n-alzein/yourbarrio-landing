const ATTRIBUTE_TYPE_SELECT = "select";
const SUPPORTED_ATTRIBUTE_TYPES = new Set(["select", "text", "number"]);

function normalizeKey(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizePrice(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(2));
}

function normalizeQuantity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

export function createEmptyAttribute() {
  return {
    id: undefined,
    name: "",
    type: ATTRIBUTE_TYPE_SELECT,
    required: false,
    values: [{ id: undefined, value: "" }],
  };
}

export function createEmptyVariantPayload() {
  return {
    hasOptions: false,
    attributes: [],
    variants: [],
  };
}

export function normalizeListingOptionsPayload(payload) {
  const hasOptions = Boolean(payload?.hasOptions);
  const attributes = (Array.isArray(payload?.attributes) ? payload.attributes : []).map(
    (attribute, attributeIndex) => ({
      id: attribute?.id || undefined,
      name: normalizeText(attribute?.name),
      type: SUPPORTED_ATTRIBUTE_TYPES.has(String(attribute?.type || "").trim())
        ? String(attribute.type).trim()
        : ATTRIBUTE_TYPE_SELECT,
      required: attribute?.required === true,
      sort_order:
        Number.isInteger(attribute?.sort_order) && attribute.sort_order >= 0
          ? attribute.sort_order
          : attributeIndex,
      values: (Array.isArray(attribute?.values) ? attribute.values : [])
        .map((value, valueIndex) => ({
          id: value?.id || undefined,
          value: normalizeText(value?.value),
          sort_order:
            Number.isInteger(value?.sort_order) && value.sort_order >= 0
              ? value.sort_order
              : valueIndex,
        }))
        .filter((value) => value.value.length > 0),
    })
  );

  const variants = (Array.isArray(payload?.variants) ? payload.variants : []).map(
    (variant, variantIndex) => {
      const optionEntries = Object.entries(
        variant?.options && typeof variant.options === "object" ? variant.options : {}
      )
        .map(([attributeName, value]) => [normalizeText(attributeName), normalizeText(value)])
        .filter(([attributeName, value]) => attributeName && value);

      return {
        id: variant?.id || undefined,
        sku: normalizeText(variant?.sku) || undefined,
        price: normalizePrice(variant?.price),
        quantity: normalizeQuantity(variant?.quantity),
        is_active: variant?.is_active !== false,
        sort_order:
          Number.isInteger(variant?.sort_order) && variant.sort_order >= 0
            ? variant.sort_order
            : variantIndex,
        options: Object.fromEntries(optionEntries),
      };
    }
  );

  return {
    hasOptions,
    attributes,
    variants,
  };
}

export function buildVariantLabel(options) {
  return Object.values(options || {})
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" / ");
}

function getVariantValueSequence(options, attributeOrder = []) {
  const normalizedOptions =
    options && typeof options === "object" ? options : {};
  const orderedValues = attributeOrder
    .map((attributeName) => normalizeText(normalizedOptions?.[attributeName]))
    .filter(Boolean);

  if (orderedValues.length === attributeOrder.length && orderedValues.length > 0) {
    return orderedValues;
  }

  return Object.values(normalizedOptions)
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

export function generateVariantCombinations(attributes) {
  const normalizedAttributes = normalizeListingOptionsPayload({
    hasOptions: true,
    attributes,
  }).attributes;

  if (!normalizedAttributes.length) return [];

  let combinations = [{}];
  for (const attribute of normalizedAttributes) {
    const values = attribute.values.map((value) => value.value).filter(Boolean);
    if (!values.length) return [];
    combinations = combinations.flatMap((current) =>
      values.map((value) => ({
        ...current,
        [attribute.name]: value,
      }))
    );
  }

  return combinations;
}

function getVariantCombinationKey(options, attributeOrder = []) {
  const values = getVariantValueSequence(options, attributeOrder);
  return values
    .map((value, index) => `${index}=${normalizeKey(value)}`)
    .join("|");
}

export function syncVariantsWithGeneratedCombinations(attributes, existingVariants = []) {
  const normalized = normalizeListingOptionsPayload({
    hasOptions: true,
    attributes,
    variants: existingVariants,
  });
  const attributeOrder = normalized.attributes.map((attribute) => attribute.name);
  const existingByKey = new Map(
    normalized.variants.map((variant) => [
      getVariantCombinationKey(variant.options, attributeOrder),
      variant,
    ])
  );

  return generateVariantCombinations(normalized.attributes).map((options, index) => {
    const key = getVariantCombinationKey(options, attributeOrder);
    const existing = existingByKey.get(key);
    return {
      id: existing?.id,
      sku: existing?.sku || "",
      price: existing?.price,
      quantity: existing?.quantity ?? 0,
      is_active: existing?.is_active !== false,
      sort_order: index,
      options,
    };
  });
}

export function validateListingOptions(payload) {
  const normalized = normalizeListingOptionsPayload(payload);
  const errors = {
    form: [],
    attributes: [],
    variants: [],
  };

  if (!normalized.hasOptions) {
    return { ok: true, normalized, errors };
  }

  if (!normalized.attributes.length) {
    errors.form.push("Add at least one option when product options are enabled.");
  }

  const seenAttributeNames = new Set();
  normalized.attributes.forEach((attribute, attributeIndex) => {
    const attributeErrors = { name: "", values: [] };
    const attributeNameKey = normalizeKey(attribute.name);

    if (!attribute.name) {
      attributeErrors.name = "Option name is required.";
    } else if (seenAttributeNames.has(attributeNameKey)) {
      attributeErrors.name = "Option names must be unique.";
    } else {
      seenAttributeNames.add(attributeNameKey);
    }

    if (attribute.type !== ATTRIBUTE_TYPE_SELECT) {
      attributeErrors.name = "Phase 1 supports select-style options only.";
    }

    if (!attribute.values.length) {
      attributeErrors.values.push("Add at least one choice.");
    } else {
      const seenValues = new Set();
      attribute.values.forEach((value, valueIndex) => {
        const valueErrors = { value: "" };
        const valueKey = normalizeKey(value.value);
        if (!value.value) {
          valueErrors.value = "Choice is required.";
        } else if (seenValues.has(valueKey)) {
          valueErrors.value = "Choices must be unique within an option.";
        } else {
          seenValues.add(valueKey);
        }
        attributeErrors.values[valueIndex] = valueErrors;
      });
    }

    errors.attributes[attributeIndex] = attributeErrors;
  });

  if (!normalized.variants.length) {
    errors.form.push("Add at least one choice to each option to create variants.");
  }

  const validAttributeNames = normalized.attributes.map((attribute) => attribute.name);
  const variantKeys = new Set();
  normalized.variants.forEach((variant, variantIndex) => {
    const variantErrors = { quantity: "", price: "", options: "" };
    const optionKeys = Object.keys(variant.options || {});

    if (variant.quantity < 0) {
      variantErrors.quantity = "Quantity must be 0 or more.";
    }
    if (variant.price !== null && variant.price < 0.01) {
      variantErrors.price = "Price override must be at least 0.01.";
    }
    if (optionKeys.length !== validAttributeNames.length) {
      variantErrors.options = "Each variant must include one value for every attribute.";
    } else {
      for (const attributeName of validAttributeNames) {
        if (!normalizeText(variant.options?.[attributeName])) {
          variantErrors.options = "Each variant must include one value for every attribute.";
          break;
        }
      }
    }

    const combinationKey = getVariantCombinationKey(variant.options, validAttributeNames);
    if (variantKeys.has(combinationKey)) {
      variantErrors.options = "Duplicate variant combinations are not allowed.";
    } else {
      variantKeys.add(combinationKey);
    }

    errors.variants[variantIndex] = variantErrors;
  });

  const hasErrors =
    errors.form.length > 0 ||
    errors.attributes.some(
      (attributeError) =>
        attributeError?.name ||
        (Array.isArray(attributeError?.values) &&
          attributeError.values.some((valueError) => valueError?.value))
    ) ||
    errors.variants.some(
      (variantError) => variantError?.quantity || variantError?.price || variantError?.options
    );

  return {
    ok: !hasErrors,
    normalized,
    errors,
  };
}

export async function getListingVariants(client, listingId) {
  if (!client || !listingId) {
    return createEmptyVariantPayload();
  }

  const [{ data: attributes, error: attributesError }, { data: variants, error: variantsError }] =
    await Promise.all([
      client
        .from("listing_attributes")
        .select("id, listing_id, name, type, required, sort_order, listing_attribute_values(id, attribute_id, value, sort_order)")
        .eq("listing_id", listingId)
        .order("sort_order", { ascending: true }),
      client
        .from("listing_variants")
        .select("id, listing_id, sku, price, quantity, is_active, sort_order, listing_variant_options(attribute_value_id)")
        .eq("listing_id", listingId)
        .order("sort_order", { ascending: true }),
    ]);

  if (attributesError) {
    throw new Error(attributesError.message || "Failed to load listing attributes.");
  }
  if (variantsError) {
    throw new Error(variantsError.message || "Failed to load listing variants.");
  }

  const attributeList = Array.isArray(attributes) ? attributes : [];
  const valueById = new Map();

  const normalizedAttributes = attributeList.map((attribute) => {
    const values = Array.isArray(attribute.listing_attribute_values)
      ? [...attribute.listing_attribute_values].sort(
          (left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0)
        )
      : [];
    values.forEach((value) => {
      valueById.set(value.id, {
        attributeId: attribute.id,
        attributeName: attribute.name,
        value: value.value,
      });
    });
    return {
      id: attribute.id,
      name: attribute.name,
      type: attribute.type || ATTRIBUTE_TYPE_SELECT,
      required: attribute.required === true,
      values: values.map((value) => ({
        id: value.id,
        value: value.value,
      })),
    };
  });

  const variantList = Array.isArray(variants) ? variants : [];
  const normalizedVariants = variantList.map((variant) => {
    const options = {};
    const links = Array.isArray(variant.listing_variant_options)
      ? variant.listing_variant_options
      : [];
    links.forEach((link) => {
      const value = valueById.get(link.attribute_value_id);
      if (value?.attributeName && value?.value) {
        options[value.attributeName] = value.value;
      }
    });

    return {
      id: variant.id,
      sku: variant.sku || "",
      price: normalizePrice(variant.price),
      quantity: normalizeQuantity(variant.quantity),
      is_active: variant.is_active !== false,
      options,
    };
  });

  return {
    hasOptions: normalizedAttributes.length > 0,
    attributes: normalizedAttributes,
    variants: normalizedVariants,
  };
}

export async function saveListingVariants(listingId, variantPayload, client, accountContext = null) {
  if (!client || !listingId) {
    throw new Error("Listing options could not be saved.");
  }

  const validation = validateListingOptions(variantPayload);
  if (!validation.ok) {
    throw new Error("Listing options are incomplete.");
  }

  const { error } = await client.rpc("replace_listing_option_tree", {
    p_listing_id: listingId,
    p_payload: validation.normalized,
  });

  if (error) {
    throw new Error(error.message || "Failed to save listing options.");
  }

  return {
    ok: true,
    normalized: validation.normalized,
    accountContext,
  };
}

export function getMatchingVariant(variants, selectedOptions) {
  const list = Array.isArray(variants) ? variants : [];
  const selected = selectedOptions && typeof selectedOptions === "object" ? selectedOptions : {};
  return (
    list.find((variant) => {
      const variantOptionEntries = Object.entries(variant?.options || {});
      if (variantOptionEntries.length === 0) return false;
      if (Object.keys(selected).length !== variantOptionEntries.length) return false;
      return variantOptionEntries.every(
        ([attributeName, value]) => normalizeKey(selected?.[attributeName]) === normalizeKey(value)
      );
    }) || null
  );
}

export function isVariantCombinationAvailable(variants, candidateOptions) {
  return (Array.isArray(variants) ? variants : []).some((variant) => {
    if (variant?.is_active === false || Number(variant?.quantity || 0) <= 0) return false;
    return Object.entries(candidateOptions || {}).every(
      ([attributeName, value]) => normalizeKey(variant?.options?.[attributeName]) === normalizeKey(value)
    );
  });
}

export function getSelectableVariantValueState(attributes, variants, selectedOptions) {
  const normalizedAttributes = Array.isArray(attributes) ? attributes : [];
  const state = {};

  normalizedAttributes.forEach((attribute) => {
    const attributeName = attribute?.name;
    if (!attributeName) return;
    state[attributeName] = {};

    (Array.isArray(attribute.values) ? attribute.values : []).forEach((valueRow) => {
      const nextSelection = {
        ...(selectedOptions || {}),
        [attributeName]: valueRow.value,
      };
      state[attributeName][valueRow.value] = isVariantCombinationAvailable(variants, nextSelection);
    });
  });

  return state;
}

export function getVariantInventoryListing(listing, variant) {
  if (!variant) return listing;
  return {
    ...listing,
    inventory_status: Number(variant.quantity || 0) > 0 ? "in_stock" : "out_of_stock",
    inventory_quantity: normalizeQuantity(variant.quantity),
  };
}

export function getActiveVariantQuantityTotal(variants) {
  return (Array.isArray(variants) ? variants : []).reduce((sum, variant) => {
    if (variant?.is_active === false) return sum;
    return sum + normalizeQuantity(variant?.quantity);
  }, 0);
}

export function deriveListingInventoryFromVariants(variants, lowStockThreshold) {
  const totalQuantity = getActiveVariantQuantityTotal(variants);
  const threshold = Math.max(0, Number(lowStockThreshold) || 0);

  if (totalQuantity <= 0) {
    return {
      inventoryQuantity: 0,
      inventoryStatus: "out_of_stock",
    };
  }

  if (threshold > 0 && totalQuantity <= threshold) {
    return {
      inventoryQuantity: totalQuantity,
      inventoryStatus: "low_stock",
    };
  }

  return {
    inventoryQuantity: totalQuantity,
    inventoryStatus: "in_stock",
  };
}

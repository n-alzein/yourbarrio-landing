const UUID_ANY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeNullableUuid(value) {
  const normalized = String(value || "").trim();
  return UUID_ANY_RE.test(normalized) ? normalized : null;
}

export function getCanonicalBusinessIdForListing(listing) {
  return normalizeNullableUuid(listing?.business_entity_id);
}

export function getLegacyListingOwnerUserId(listing) {
  return normalizeNullableUuid(listing?.business_id);
}

export function getListingBusinessIdentity(listing) {
  return {
    businessEntityId: getCanonicalBusinessIdForListing(listing),
    ownerUserId: getLegacyListingOwnerUserId(listing),
  };
}

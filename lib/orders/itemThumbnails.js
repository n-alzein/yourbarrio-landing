import {
  extractStoredPhotoVariants,
  getSelectedPhotoUrl,
  primaryPhotoUrl,
  resolveListingCoverImageUrl,
} from "@/lib/listingPhotos";

export function getOrderItemThumbnailUrl(item) {
  const listing = item?.listing || item?.listings || null;
  const [selectedVariant] = extractStoredPhotoVariants(
    listing?.photo_url,
    listing?.photo_variants
  );

  return (
    listing?.main_photo_url ||
    primaryPhotoUrl(listing?.photos) ||
    resolveListingCoverImageUrl(listing) ||
    getSelectedPhotoUrl(selectedVariant) ||
    primaryPhotoUrl(listing?.photo_url) ||
    item?.image_url ||
    null
  );
}

function compareOrderItemsForThumbnails(left, right) {
  const leftCreatedAt = Date.parse(left?.created_at || "");
  const rightCreatedAt = Date.parse(right?.created_at || "");
  const hasLeftCreatedAt = Number.isFinite(leftCreatedAt);
  const hasRightCreatedAt = Number.isFinite(rightCreatedAt);

  if (hasLeftCreatedAt && hasRightCreatedAt && leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  if (hasLeftCreatedAt !== hasRightCreatedAt) {
    return hasLeftCreatedAt ? -1 : 1;
  }

  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

export function getOrderThumbnailItems(order, maxItems = 3) {
  const items = Array.isArray(order?.order_items)
    ? [...order.order_items].sort(compareOrderItemsForThumbnails)
    : [];
  const cappedMaxItems = Math.max(0, maxItems);
  const visibleItems = items.slice(0, cappedMaxItems).map((item, index) => ({
    key: item?.id || `${order?.id || "order"}-${index}`,
    url: getOrderItemThumbnailUrl(item),
    title: item?.title || "Order item",
  }));

  if (visibleItems.length === 0) {
    visibleItems.push({
      key: `${order?.id || "order"}-placeholder`,
      url: null,
      title: "Order item",
    });
  }

  return {
    items: visibleItems,
    overflowCount: Math.max(items.length - cappedMaxItems, 0),
  };
}

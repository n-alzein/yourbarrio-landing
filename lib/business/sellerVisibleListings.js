const HIDDEN_SELLER_STATUSES = new Set([
  "admin_hidden",
  "archived",
  "deleted",
  "seller_deleted",
]);

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function isSellerVisibleListing(row) {
  if (!row || typeof row !== "object") return false;
  if (row.admin_hidden === true) return false;
  if (row.seller_deleted === true) return false;
  if (row.archived === true) return false;
  if (hasValue(row.deleted_at)) return false;
  if (hasValue(row.archived_at)) return false;

  const status = String(row.status || "").trim().toLowerCase();
  if (HIDDEN_SELLER_STATUSES.has(status)) return false;

  return true;
}

export function isPublishedSellerVisibleListing(row) {
  return (
    isSellerVisibleListing(row) &&
    String(row.status || "").trim().toLowerCase() === "published"
  );
}

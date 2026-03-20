const RESTRICTED_PURCHASE_ROLES = new Set(["business", "admin"]);

export function isPurchaseRestrictedRole({ role = null, isInternal = false } = {}) {
  if (isInternal === true) return true;
  if (typeof role !== "string") return false;
  return RESTRICTED_PURCHASE_ROLES.has(role.trim().toLowerCase());
}

export function getPurchaseRestrictionMessage() {
  return "Customer accounts only.";
}

export function getPurchaseRestrictionHelpText() {
  return "Business accounts cannot place customer orders.";
}

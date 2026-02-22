export function isCustomerNearbyPath(pathname: string): boolean {
  const normalized = String(pathname || "").trim();
  return normalized === "/customer/nearby" || normalized.startsWith("/customer/nearby/");
}

export function isCustomerNearbyPublicAllowed(
  pathname: string,
  flagEnabled: boolean
): boolean {
  return Boolean(flagEnabled) && isCustomerNearbyPath(pathname);
}

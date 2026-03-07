export function isBusinessOnboardingComplete(businessRow) {
  if (!businessRow || typeof businessRow !== "object") return false;

  const requiredFields = [
    businessRow.business_name,
    businessRow.category,
    businessRow.address,
    businessRow.city,
    businessRow.state,
    businessRow.postal_code,
  ];

  return requiredFields.every((value) => String(value || "").trim().length > 0);
}


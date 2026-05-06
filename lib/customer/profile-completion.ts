import { isCompleteUsPhone } from "@/lib/utils/formatUSPhone";
import { normalizeStateCode } from "@/lib/location/normalizeStateCode";

type CustomerProfile = {
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
};

export type CustomerProfileMissingField = "full_name" | "phone" | "address";

function trim(value: unknown) {
  return String(value ?? "").trim();
}

function hasValidPostalCode(value: unknown) {
  const postalCode = trim(value);
  return /^[0-9]{5}(-[0-9]{4})?$/.test(postalCode);
}

export function getCustomerProfileCompletion(profile: CustomerProfile | null | undefined) {
  const hasFullName = Boolean(trim(profile?.full_name));
  const hasPhone = isCompleteUsPhone(profile?.phone);
  const hasAddress = Boolean(
    trim(profile?.address) &&
      trim(profile?.city) &&
      normalizeStateCode(profile?.state) &&
      hasValidPostalCode(profile?.postal_code)
  );

  const missingFields: CustomerProfileMissingField[] = [];
  if (!hasFullName) missingFields.push("full_name");
  if (!hasPhone) missingFields.push("phone");
  if (!hasAddress) missingFields.push("address");

  const completedCount = 3 - missingFields.length;
  const completionPercent = Math.round((completedCount / 3) * 100);
  const nextRecommendedAction = missingFields[0] || null;

  return {
    hasFullName,
    hasPhone,
    hasAddress,
    completedCount,
    totalCount: 3,
    completionPercent,
    missingFields,
    nextRecommendedAction,
  };
}

export function getCustomerProfileActionLabel(
  field: CustomerProfileMissingField | null | undefined
) {
  if (field === "full_name") return "Add your name";
  if (field === "phone") return "Add your phone";
  if (field === "address") return "Add your address";
  return "Complete profile";
}

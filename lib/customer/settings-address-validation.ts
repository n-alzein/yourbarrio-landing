import { normalizeStateCode } from "@/lib/location/normalizeStateCode";

function trimValue(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeCustomerSettingsAddressPayload(values: Record<string, unknown> = {}) {
  const normalized = {
    address: trimValue(values.address),
    address_2: trimValue(values.address_2),
    city: trimValue(values.city),
    state: normalizeStateCode(values.state) || "",
    postal_code: trimValue(values.postal_code),
  };

  const hasActualAddressInput = Boolean(
    normalized.address ||
      normalized.address_2 ||
      normalized.city ||
      normalized.postal_code
  );

  if (!hasActualAddressInput) {
    return {
      address: "",
      address_2: "",
      city: "",
      state: "",
      postal_code: "",
    };
  }

  return normalized;
}

export function validateCustomerSettingsAddress(values: Record<string, unknown> = {}) {
  const normalized = normalizeCustomerSettingsAddressPayload(values);
  const errors: Record<string, string> = {};
  const hasAnyAddressInput = Boolean(
    normalized.address ||
      normalized.address_2 ||
      normalized.city ||
      normalized.state ||
      normalized.postal_code
  );

  if (!hasAnyAddressInput) return errors;

  if (!normalized.address) {
    errors.address =
      "Street address is required when city, state, or postal code is filled.";
  }

  if (!normalized.city) {
    errors.city = "City is required when state or postal code is filled.";
  }

  if (!normalized.state) {
    errors.state = "State is required when adding an address.";
  } else if (!/^[A-Z]{2}$/.test(normalized.state)) {
    errors.state = "Use a 2-letter state code (e.g., CA).";
  }

  if (!normalized.postal_code) {
    errors.postal_code = "Postal code is required when adding an address.";
  } else if (!/^[0-9]{5}(-[0-9]{4})?$/.test(normalized.postal_code)) {
    errors.postal_code = "Use ZIP or ZIP+4 (e.g., 94107 or 94107-1234).";
  }

  return errors;
}

export function getVisibleCustomerSettingsAddressErrors(
  errors: Record<string, string> = {},
  touchedFields: Record<string, boolean> = {},
  submitAttempted = false
) {
  if (submitAttempted) return errors;

  return Object.fromEntries(
    Object.entries(errors).filter(([key]) => touchedFields[key])
  );
}

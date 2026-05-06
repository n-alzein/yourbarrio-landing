import { describe, expect, it } from "vitest";
import {
  getVisibleCustomerSettingsAddressErrors,
  normalizeCustomerSettingsAddressPayload,
  validateCustomerSettingsAddress,
} from "@/lib/customer/settings-address-validation";

describe("customer settings address validation", () => {
  it("treats default California alone as an empty address", () => {
    expect(
      normalizeCustomerSettingsAddressPayload({
        address: "",
        city: "",
        state: "CA",
        postal_code: "",
      })
    ).toEqual({
      address: "",
      address_2: "",
      city: "",
      state: "",
      postal_code: "",
    });
    expect(validateCustomerSettingsAddress({ state: "CA" })).toEqual({});
  });

  it("does not show partial-address errors for a fully empty address", () => {
    expect(
      validateCustomerSettingsAddress({
        address: "",
        city: "",
        state: "",
        postal_code: "",
      })
    ).toEqual({});
  });

  it("requires street when city is entered", () => {
    expect(validateCustomerSettingsAddress({ city: "Long Beach", state: "CA" })).toEqual(
      expect.objectContaining({
        address: "Street address is required when city, state, or postal code is filled.",
        postal_code: "Postal code is required when adding an address.",
      })
    );
  });

  it("requires street and city when postal code is entered", () => {
    expect(validateCustomerSettingsAddress({ postal_code: "90802", state: "CA" })).toEqual(
      expect.objectContaining({
        address: "Street address is required when city, state, or postal code is filled.",
        city: "City is required when state or postal code is filled.",
      })
    );
  });

  it("accepts complete address fields", () => {
    expect(
      validateCustomerSettingsAddress({
        address: "123 Main St",
        city: "Long Beach",
        state: "CA",
        postal_code: "90802",
      })
    ).toEqual({});
  });

  it("does not show other required-field errors while only street is being typed", () => {
    const errors = validateCustomerSettingsAddress({
      address: "123 Main St",
      state: "CA",
    });

    expect(errors).toEqual(
      expect.objectContaining({
        city: "City is required when state or postal code is filled.",
        postal_code: "Postal code is required when adding an address.",
      })
    );
    expect(getVisibleCustomerSettingsAddressErrors(errors, {}, false)).toEqual({});
    expect(
      getVisibleCustomerSettingsAddressErrors(errors, { address: true }, false)
    ).toEqual({});
  });

  it("shows city error after city is blurred while address is partially filled", () => {
    const errors = validateCustomerSettingsAddress({
      address: "123 Main St",
      state: "CA",
    });

    expect(getVisibleCustomerSettingsAddressErrors(errors, { city: true }, false)).toEqual({
      city: "City is required when state or postal code is filled.",
    });
  });

  it("shows all relevant partial-address errors after save is attempted", () => {
    const errors = validateCustomerSettingsAddress({
      address: "123 Main St",
      state: "",
    });

    expect(getVisibleCustomerSettingsAddressErrors(errors, {}, true)).toEqual(
      expect.objectContaining({
        city: "City is required when state or postal code is filled.",
        state: "State is required when adding an address.",
        postal_code: "Postal code is required when adding an address.",
      })
    );
  });

  it("clears visible errors when address is cleared back to empty", () => {
    const errors = validateCustomerSettingsAddress({
      address: "",
      city: "",
      state: "CA",
      postal_code: "",
    });

    expect(errors).toEqual({});
    expect(
      getVisibleCustomerSettingsAddressErrors(errors, { city: true }, true)
    ).toEqual({});
  });
});

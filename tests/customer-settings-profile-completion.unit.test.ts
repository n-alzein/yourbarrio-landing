import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/(customer)/customer/settings/page.js"),
  "utf8"
);

describe("customer settings profile completion UI", () => {
  it("renders a completion banner when the customer profile is incomplete", () => {
    expect(source).toContain("<ProfileCompletionCard");
    expect(source).toContain("Complete your profile");
    expect(source).toContain(
      "Add a few details for faster checkout, order updates, and pickup coordination."
    );
    expect(source).toContain("{completion.completedCount} of {completion.totalCount} complete");
  });

  it("does not render the completion banner when the customer profile is complete", () => {
    expect(source).toContain("if (!completion || completion.missingFields.length === 0) return null;");
    expect(source).toContain("getCustomerProfileCompletion(currentProfile)");
  });

  it("shows intentional empty states and field actions for missing fields", () => {
    expect(source).toContain('emptyLabel = "Not added yet"');
    expect(source).toContain('actionLabel="Add name"');
    expect(source).toContain('actionLabel="Add phone"');
    expect(source).toContain('actionLabel="Add address"');
  });

  it("derives completion from live profile state and merges saved API profiles immediately", () => {
    expect(source).toContain("const [liveProfile, setLiveProfile]");
    expect(source).toContain("const currentProfile = liveProfile || effectiveProfile");
    expect(source).toContain("const updatedProfile = mergeProfile(currentProfile, payload?.profile)");
    expect(source).toContain("setLiveProfile(updatedProfile)");
    expect(source).toContain("setForm(buildInitialForm(updatedProfile))");
  });

  it("uses canonical live profile state for read-only settings display", () => {
    expect(source).toContain("const displayForm = useMemo(() => buildInitialForm(currentProfile)");
    expect(source).toContain("value={displayForm.full_name}");
    expect(source).toContain("value={displayForm.phone}");
    expect(source).toContain("value={displayForm.address}");
    expect(source).toContain("value={displayForm.postal_code}");
  });

  it("syncs form from changed profile context without clobbering active edits", () => {
    expect(source).toContain("getProfileSyncSignature(currentProfile)");
    expect(source).toContain("if (activeSection) return;");
    expect(source).toContain("lastFormProfileSignatureRef.current = nextSignature");
  });

  it("background refresh happens after local settings state updates", () => {
    const localUpdateIndex = source.indexOf("setLiveProfile(updatedProfile)");
    const refreshIndex = source.indexOf("refreshProfile?.()");

    expect(localUpdateIndex).toBeGreaterThan(-1);
    expect(refreshIndex).toBeGreaterThan(-1);
    expect(localUpdateIndex).toBeLessThan(refreshIndex);
  });

  it("sends only the active settings section fields to the profile API", () => {
    expect(source).toContain("const profilePayload =");
    expect(source).toContain('activeSection === "address"');
    expect(source).toContain("body: JSON.stringify(profilePayload)");
    expect(source).toContain("full_name: form.full_name");
    expect(source).toContain("address: normalizedAddress.address || null");
  });

  it("updates shared auth profile state before background refresh", () => {
    const updateIndex = source.indexOf("updateProfile?.(updatedProfile)");
    const refreshIndex = source.indexOf("refreshProfile?.()");

    expect(updateIndex).toBeGreaterThan(-1);
    expect(refreshIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeLessThan(refreshIndex);
  });

  it("only exits edit mode and shows success after the profile API succeeds", () => {
    const okIndex = source.indexOf("if (response.ok) {");
    const clearEditIndex = source.indexOf("setActiveSection(null)", okIndex);
    const successIndex = source.indexOf('showToast("success", "Settings updated.")');
    const errorIndex = source.indexOf('showToast("error", payload?.error || "Failed to save settings.")');

    expect(okIndex).toBeGreaterThan(-1);
    expect(clearEditIndex).toBeGreaterThan(okIndex);
    expect(successIndex).toBeGreaterThan(okIndex);
    expect(errorIndex).toBeGreaterThan(successIndex);
  });

  it("queues and focuses the requested field after progressive profile CTAs enter edit mode", () => {
    expect(source).toContain("const [pendingFocusField, setPendingFocusField]");
    expect(source).toContain("const fullNameInputRef = useRef(null)");
    expect(source).toContain("const phoneInputRef = useRef(null)");
    expect(source).toContain("const streetAddressInputRef = useRef(null)");
    expect(source).toContain("beginSectionEditWithFocus(\"profile\", \"fullName\")");
    expect(source).toContain("beginSectionEditWithFocus(\"profile\", \"phone\")");
    expect(source).toContain("beginSectionEditWithFocus(\"address\", \"streetAddress\")");
    expect(source).toContain("target.focus({ preventScroll: true })");
  });

  it("clears pending focus on cancel and only scrolls address below the navbar", () => {
    expect(source).toContain("setPendingFocusField(null)");
    expect(source).toContain('const shouldScrollTargetIntoView = pendingFocusField === "streetAddress"');
    expect(source).toContain("if (shouldScrollTargetIntoView) {");
    expect(source).toContain("const navOffset = 112");
    expect(source).toContain("window.scrollTo({");
    expect(source).toContain("behavior: \"smooth\"");
  });

  it("keeps progressive CTAs as keyboard-activatable buttons", () => {
    expect(source).toContain("<button\n          type=\"button\"\n          onClick={onPrimaryAction}");
    expect(source).toContain("<button\n          type=\"button\"\n          onClick={onAction}");
  });

  it("gates address errors behind touched fields or address save attempts", () => {
    expect(source).toContain("const [addressTouchedFields, setAddressTouchedFields]");
    expect(source).toContain("const [addressSaveAttempted, setAddressSaveAttempted]");
    expect(source).toContain("getVisibleCustomerSettingsAddressErrors(");
    expect(source).toContain("const getAddressFieldError = (key) =>");
    expect(source).not.toContain("addressHasInteraction");
    expect(source).toContain("onBlur={() => handleAddressFieldBlur(\"address\")}");
    expect(source).toContain("onBlur={() => handleAddressFieldBlur(\"city\")}");
    expect(source).toContain("onBlur={() => handleAddressFieldBlur(\"postal_code\")}");
  });

  it("uses customer settings address normalization so state alone saves as no address", () => {
    expect(source).toContain("normalizeCustomerSettingsAddressPayload(form)");
    expect(source).toContain("validateCustomerSettingsAddress(normalizedAddress)");
  });

  it("handles complete=profile query param by focusing the next missing field once", () => {
    expect(source).toContain("const searchParams = useSearchParams()");
    expect(source).toContain("const handledCompleteProfileParamRef = useRef(false)");
    expect(source).toContain('searchParams?.get("complete") !== "profile"');
    expect(source).toContain("if (!nextAction) return;");
    expect(source).toContain("beginProfileCompletionAction()");
    expect(source).toContain('url.searchParams.delete("complete")');
    expect(source).toContain("window.history.replaceState(");
  });
});

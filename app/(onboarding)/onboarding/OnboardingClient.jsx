"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import AIDescriptionAssistant from "@/components/business/AIDescriptionAssistant";
import { getBusinessTypeOptions } from "@/lib/taxonomy/businessTypes";
import { isBusinessOnboardingComplete } from "@/lib/business/onboardingCompletion";
import { US_STATES } from "@/lib/constants/usStates";
import { normalizeStateCode } from "@/lib/location/normalizeStateCode";
import {
  formatUSPhone,
  isIncompleteUSPhone,
  normalizeUSPhoneForStorage,
} from "@/lib/utils/formatUSPhone";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const PHONE_VERIFICATION_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PHONE_VERIFICATION === "true";
const PLACES_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_PLACES === "true" ||
  process.env.NEXT_PUBLIC_DISABLE_PLACES === "1" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DISABLE_PLACES !== "false");

const ADDRESS_FIELDS = new Set(["address", "address_2", "city", "state", "postal_code"]);

// ------------------------------
// State + reducer (must be ABOVE component)
// ------------------------------
const initialForm = {
  businessName: "",
  business_type: "",
  description: "",
  address: "",
  address_2: "",
  city: "",
  state: "",
  postal_code: "",
  notificationsPhone: "",
  phone: "",
  website: "",
};

function formReducer(state, action) {
  return { ...state, [action.field]: action.value };
}

function normalizeWebsite(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

function normalizeAddressPayload(values) {
  const trimValue = (value) => (value ?? "").trim();
  const stateValue = normalizeStateCode(trimValue(values.state)) || "";
  const postalValue = trimValue(values.postal_code);
  return {
    address: trimValue(values.address),
    address_2: trimValue(values.address_2),
    city: trimValue(values.city),
    state: stateValue,
    postal_code: postalValue,
  };
}

function validateAddressFields(values) {
  const errors = {};
  const hasStreet = Boolean(values.address);
  const hasCity = Boolean(values.city);
  const hasState = Boolean(values.state);
  const hasPostal = Boolean(values.postal_code);

  if (!hasStreet) {
    errors.address = "Street address is required.";
  }

  if (!hasCity) {
    errors.city = "City is required.";
  }

  if (!hasState) {
    errors.state = "State is required.";
  }

  if (!hasPostal) {
    errors.postal_code = "Postal code is required.";
  }

  if (hasState && !/^[A-Z]{2}$/.test(values.state)) {
    errors.state = "Use a 2-letter state code (e.g., CA).";
  }

  if (hasPostal && !/^[0-9]{5}(-[0-9]{4})?$/.test(values.postal_code)) {
    errors.postal_code = "Use ZIP or ZIP+4 (e.g., 94107 or 94107-1234).";
  }

  return errors;
}

function buildAddressQuery(values) {
  return [values.address, values.city, values.state, values.postal_code]
    .map((value) => (value || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function extractContextValue(feature, prefix) {
  if (!feature?.context) return null;
  return feature.context.find((item) => item.id?.startsWith(`${prefix}.`)) || null;
}

function resolveStateCode(region) {
  if (!region) return "";
  if (region.short_code) {
    const code = region.short_code.split("-").pop();
    return normalizeStateCode(code || region.short_code) || "";
  }
  return normalizeStateCode(region.text) || "";
}

const BUSINESS_TYPE_OPTIONS = getBusinessTypeOptions();
const DEFAULT_BUSINESS_PREVIEW_IMAGE = "/placeholders/business/types/boutique.png";
const BUSINESS_TYPE_PREVIEW_IMAGES = new Map(
  BUSINESS_TYPE_OPTIONS.map((type) => [
    type.slug,
    `/placeholders/business/types/${type.slug}.png`,
  ])
);

function getBusinessTypePreviewImage(slug) {
  return BUSINESS_TYPE_PREVIEW_IMAGES.get(slug) || DEFAULT_BUSINESS_PREVIEW_IMAGE;
}

// ------------------------------
// MAIN COMPONENT (only ONE export default)
// ------------------------------
export default function BusinessOnboardingPage() {
  const { user, loadingUser, refreshProfile } = useAuth();
  const router = useRouter();

  const [form, dispatch] = useReducer(formReducer, initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [step, setStep] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPulse, setPreviewPulse] = useState(false);
  const [toast, setToast] = useState(null);
  const [phoneVerification, setPhoneVerification] = useState({
    status: "default",
    code: "",
    error: "",
  });
  const pickedLocationRef = useRef(null); // stores { lat, lng } from address lookup
  const toastTimerRef = useRef(null);

  const selectedBusinessType =
    BUSINESS_TYPE_OPTIONS.find((type) => type.slug === form.business_type) || null;
  const isStepOneValid = Boolean(
    form.businessName.trim() &&
      form.business_type.trim() &&
      form.description.trim()
  );
  const previewName = form.businessName.trim() || "Your shop";
  const previewType = selectedBusinessType?.label || "Local business";
  const previewDescription =
    form.description.trim() ||
    "A quick, welcoming description will appear here as you shape your shop.";
  const previewImageSrc = getBusinessTypePreviewImage(selectedBusinessType?.slug);
  const previewState =
    US_STATES.find((stateOption) => stateOption.code === form.state)?.name || form.state;
  const previewLocation = [form.city, previewState].filter(Boolean).join(", ") || "Nearby";

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.info("[AUTH_REDIRECT_TRACE] onboarding_mount", {
        pathname: window.location.pathname,
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function showToast(message) {
    setToast(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }

  function updateField(field, value, options = {}) {
    dispatch({ field, value });
    if (ADDRESS_FIELDS.has(field) && !options.keepLocation) {
      pickedLocationRef.current = null;
    }
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function updateFields(payload, options = {}) {
    Object.entries(payload).forEach(([field, value]) =>
      updateField(field, value, options)
    );
  }

  useEffect(() => {
    if (!MAPBOX_TOKEN || PLACES_DISABLED) {
      setAddressSuggestions([]);
      return;
    }

    const query = buildAddressQuery({
      address: form.address,
      city: form.city,
      state: form.state,
      postal_code: form.postal_code,
    });
    if (query.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const url = new URL(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query
          )}.json`
        );
        url.searchParams.set("access_token", MAPBOX_TOKEN);
        url.searchParams.set("types", "address");
        url.searchParams.set("limit", "5");
        url.searchParams.set("autocomplete", "true");

        const res = await fetch(url.toString());
        if (!res.ok) return;
        const payload = await res.json();
        const nextSuggestions = (payload.features || [])
          .map((feature) => {
            const center = Array.isArray(feature.center) ? feature.center : [];
            const [lng, lat] = center;
            if (typeof lat !== "number" || typeof lng !== "number") return null;

            const addressNumber = feature.address || feature.properties?.address || "";
            const streetLine = [addressNumber, feature.text]
              .filter(Boolean)
              .join(" ")
              .trim();
            const place = extractContextValue(feature, "place");
            const locality = extractContextValue(feature, "locality");
            const region = extractContextValue(feature, "region");
            const postcode = extractContextValue(feature, "postcode");
            const city = place?.text || locality?.text || "";
            const state = resolveStateCode(region);
            const postal_code = postcode?.text || "";

            return {
              label: feature.place_name || streetLine || feature.text,
              address: streetLine || feature.text,
              city,
              state,
              postal_code,
              coords: { lat, lng },
            };
          })
          .filter(Boolean);
        if (!cancelled) {
          setAddressSuggestions(nextSuggestions);
        }
      } catch (err) {
        if (!cancelled) {
          setAddressSuggestions([]);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [form.address, form.city, form.state, form.postal_code]);

  function applySuggestion(item) {
    updateFields(
      {
        address: item.address || form.address,
        city: item.city || form.city,
        state: item.state || form.state,
        postal_code: item.postal_code || form.postal_code,
      },
      { keepLocation: true }
    );
    pickedLocationRef.current = item.coords;
  }

  useEffect(() => {
    setPreviewPulse(true);
    const handle = setTimeout(() => setPreviewPulse(false), 180);
    return () => clearTimeout(handle);
  }, [
    form.businessName,
    form.business_type,
    form.description,
    form.city,
    form.state,
    form.notificationsPhone,
    form.website,
  ]);

  function handleNotificationsPhoneChange(value) {
    updateField("notificationsPhone", formatUSPhone(value));
    setPhoneVerification({ status: "default", code: "", error: "" });
  }

  function handleVerificationCodeChange(value) {
    const code = value.replace(/\D/g, "").slice(0, 6);
    setPhoneVerification((prev) => ({ ...prev, code, error: "" }));
  }

  async function handleSendVerificationCode() {
    const normalizedPhone = normalizeUSPhoneForStorage(form.notificationsPhone);
    if (!normalizedPhone) {
      setFieldErrors((prev) => ({
        ...prev,
        notificationsPhone: "Enter a complete 10-digit US phone number.",
      }));
      return;
    }

    if (!PHONE_VERIFICATION_ENABLED) {
      setPhoneVerification((prev) => ({
        ...prev,
        status: "default",
        error: "",
      }));
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.notificationsPhone;
        return next;
      });
      showToast("Phone verification will be available soon");
      return;
    }

    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.notificationsPhone;
      return next;
    });
    setPhoneVerification({ status: "sending", code: "", error: "" });
    await new Promise((resolve) => setTimeout(resolve, 450));
    setPhoneVerification({ status: "enter_code", code: "", error: "" });
  }

  function handleConfirmVerificationCode() {
    if (phoneVerification.code.length !== 6) {
      setPhoneVerification((prev) => ({
        ...prev,
        status: "error",
        error: "Enter the 6-digit code.",
      }));
      return;
    }

    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.notificationsPhone;
      return next;
    });
    setPhoneVerification({ status: "verified", code: "", error: "" });
  }

  function validateStepOne() {
    const errors = {};
    if (!form.businessName.trim()) {
      errors.businessName = "Business name is required.";
    }
    if (!form.business_type.trim()) {
      errors.business_type = "Choose a shop category.";
    }
    if (!form.description.trim()) {
      errors.description = "Description is required.";
    }
    return errors;
  }

  function validateStepTwo() {
    const normalizedAddress = normalizeAddressPayload(form);
    const errors = validateAddressFields(normalizedAddress);
    const normalizedNotificationsPhone = normalizeUSPhoneForStorage(
      form.notificationsPhone
    );

    if (!String(form.notificationsPhone || "").trim()) {
      errors.notificationsPhone = "Notifications phone is required.";
    } else if (isIncompleteUSPhone(form.notificationsPhone)) {
      errors.notificationsPhone = "Enter a complete 10-digit US phone number.";
    } else if (!normalizedNotificationsPhone) {
      errors.notificationsPhone = "Enter a complete 10-digit US phone number.";
    }
    if (isIncompleteUSPhone(form.phone)) {
      errors.phone = "Enter a complete 10-digit US phone number.";
    }

    return { errors, normalizedAddress, normalizedNotificationsPhone };
  }

  function handleContinue() {
    const validationErrors = validateStepOne();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...validationErrors }));
      setMessage("Fix the highlighted fields.");
      return;
    }
    setMessage("");
    setStep(2);
  }

  function handleBack() {
    setMessage("");
    setStep(1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (step === 1) {
      handleContinue();
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      if (loadingUser) {
        setLoading(false);
        return;
      }

      const verifiedUser = user;
      if (!verifiedUser) {
        setMessage("You must be logged in to create a business.");
        setLoading(false);
        router.push("/business/login");
        return;
      }

      const stepOneErrors = validateStepOne();
      const {
        errors: stepTwoErrors,
        normalizedAddress,
        normalizedNotificationsPhone,
      } = validateStepTwo();
      const validationErrors = { ...stepOneErrors, ...stepTwoErrors };
      if (Object.keys(validationErrors).length > 0) {
        setFieldErrors(validationErrors);
        setMessage("Fix the highlighted fields.");
        if (Object.keys(stepOneErrors).length > 0) {
          setStep(1);
        }
        setLoading(false);
        return;
      }

      const normalizedWebsite = normalizeWebsite(form.website);

      // 2) Create or update business entry via authenticated server route
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.businessName,
          business_type: form.business_type,
          description: form.description,
          address: normalizedAddress.address,
          address_2: normalizedAddress.address_2,
          city: normalizedAddress.city,
          state: normalizedAddress.state,
          postal_code: normalizedAddress.postal_code,
          notifications_phone: normalizedNotificationsPhone,
          notifications_phone_verified: phoneVerification.status === "verified",
          phone: normalizeUSPhoneForStorage(form.phone),
          website: normalizedWebsite,
          latitude: pickedLocationRef.current?.lat ?? null,
          longitude: pickedLocationRef.current?.lng ?? null,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        if (process.env.NODE_ENV !== "production") {
          console.error("[onboarding] business save failed", {
            status: res.status,
            code: errBody?.code || null,
            message: errBody?.error || "Failed to save business",
          });
        }
        throw new Error(errBody.error || "Failed to save business");
      }

      const payload = await res.json();
      const savedRow = payload?.row || null;
      if (process.env.NODE_ENV !== "production") {
        console.warn("[AUTH_REDIRECT_TRACE] onboarding_submit_saved_row", {
          keys: Object.keys(savedRow || {}),
        });
      }

      if (!savedRow || !isBusinessOnboardingComplete(savedRow)) {
        setMessage("Business profile save was incomplete. Please try again.");
        setLoading(false);
        return;
      }

      // 3) Redirect to business workspace
      await refreshProfile();
      router.replace("/business/dashboard");
      router.refresh();
    } catch (err) {
      console.error("Onboarding submit failed", err);
      setMessage(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fbf9ff] px-4 pb-32 pt-6 text-slate-950 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto grid max-w-7xl gap-10 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[45fr_55fr] lg:items-center xl:gap-14">
        <aside className="hidden lg:block">
          <ShopPreview
            name={previewName}
            type={previewType}
            description={previewDescription}
            location={previewLocation}
            imageSrc={previewImageSrc}
            pulse={previewPulse}
          />
        </aside>

        <main className="mx-auto w-full max-w-[680px] lg:max-w-none">
          <form id="business-onboarding-form" onSubmit={handleSubmit} className="w-full">
            <div className="rounded-[24px] border border-white/80 bg-white p-5 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.65)] sm:p-7">
              <div className="mb-7 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-[32px] font-semibold leading-tight tracking-normal text-slate-950">
                    {step === 1 ? "Tell us about your shop" : "Set up your shop details"}
                  </h1>
                  <p className="mt-2 text-sm text-slate-500">Takes less than 2 minutes</p>
                </div>
                <StepDots step={step} />
              </div>

            {message ? (
              <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {message}
              </div>
            ) : null}

            {toast ? (
              <div className="mb-6 rounded-xl border border-[#d9ccff] bg-[#f4f0ff] px-4 py-3 text-sm font-medium text-[#5d2bd6] shadow-[0_16px_30px_-24px_rgba(110,52,255,0.55)]">
                {toast}
              </div>
            ) : null}

              <div key={step} className="overflow-visible [animation:onboardingStepSlide_180ms_ease-out]">
                {step === 1 ? (
                  <div>
                    <FormField
                      label="Business name"
                      value={form.businessName}
                      placeholder="Your shop name"
                      onChange={(v) => updateField("businessName", v)}
                      required
                      error={fieldErrors.businessName}
                    />

                    <div className="mt-[22px]">
                      <FormField
                        label="Business type"
                        value={form.business_type}
                        placeholder="Choose your shop category"
                        onChange={(v) => updateField("business_type", v)}
                        required
                        options={BUSINESS_TYPE_OPTIONS.map((type) => ({
                          value: type.slug,
                          label: type.label,
                        }))}
                        error={fieldErrors.business_type}
                      />
                    </div>

                    <div className="mt-[22px]">
                      <FormTextArea
                        label="Description"
                        value={form.description}
                        placeholder="Describe your shop"
                        rows={4}
                        onChange={(v) => updateField("description", v)}
                        required
                        error={fieldErrors.description}
                        action={
                          <AIDescriptionAssistant
                            type="business"
                            name={form.businessName}
                            category={form.business_type}
                            value={form.description}
                            onApply={(description) => updateField("description", description)}
                            context="onboarding"
                            compact
                            label="Generate with AI"
                          />
                        }
                      />
                    </div>

                    <div className="hidden pt-5 sm:block">
                      <PrimaryButton
                        type="button"
                        disabled={!isStepOneValid}
                        onClick={handleContinue}
                      >
                        Continue
                      </PrimaryButton>
                    </div>
                  </div>
                ) : (
                  <div>
                    <FormField
                      label="Street address"
                      value={form.address}
                      placeholder="Street address"
                      listId="address-suggestions"
                      onChange={(v) => {
                        updateField("address", v);
                        const match = addressSuggestions.find((item) => item.label === v);
                        if (match) {
                          applySuggestion(match);
                        }
                      }}
                      required
                      error={fieldErrors.address}
                    />

                    {addressSuggestions.length ? (
                      <datalist id="address-suggestions">
                        {addressSuggestions.map((item) => (
                          <option key={item.label} value={item.label} />
                        ))}
                      </datalist>
                    ) : null}

                    <div className="mt-[18px] grid items-start gap-[18px] sm:grid-cols-[1fr_0.62fr_0.84fr]">
                      <FormField
                        label="City"
                        value={form.city}
                        placeholder=""
                        onChange={(v) => updateField("city", v)}
                        required
                        error={fieldErrors.city}
                      />

                      <FormField
                        label="State"
                        value={form.state}
                        placeholder=""
                        onChange={(v) => updateField("state", v)}
                        required
                        error={fieldErrors.state}
                        options={US_STATES.map((stateOption) => ({
                          value: stateOption.code,
                          label: stateOption.code,
                        }))}
                      />

                      <FormField
                        label="ZIP"
                        value={form.postal_code}
                        placeholder=""
                        onChange={(v) => updateField("postal_code", v)}
                        required
                        error={fieldErrors.postal_code}
                      />
                    </div>

                    <div className="mt-[18px]">
                      <FormField
                        label="Apt / Suite"
                        value={form.address_2}
                        placeholder=""
                        onChange={(v) => updateField("address_2", v)}
                      />
                    </div>

                    <div className="mt-7 border-t border-slate-200/60 pt-7">
                      <SectionHeading title="Public contact details (optional)" />
                      <div className="mt-[18px] grid gap-[18px] sm:grid-cols-2">
                        <FormField
                          label="Public phone"
                          value={form.phone}
                          placeholder=""
                          onChange={(v) => updateField("phone", formatUSPhone(v))}
                          helper="Shown on your shop page for customers to contact you"
                          error={fieldErrors.phone}
                        />

                        <FormField
                          label="Website"
                          value={form.website}
                          placeholder="yourdomain.com"
                          onChange={(v) => updateField("website", v)}
                        />
                      </div>
                    </div>

                    <div className="mt-7 border-t border-slate-200/60 pt-7">
                      <SectionHeading title="Order notifications" />
                      <div className="mt-[18px]">
                        <NotificationsPhoneField
                          value={form.notificationsPhone}
                          code={phoneVerification.code}
                          status={phoneVerification.status}
                          verificationError={phoneVerification.error}
                          error={fieldErrors.notificationsPhone}
                          onChange={handleNotificationsPhoneChange}
                          onSendCode={handleSendVerificationCode}
                          onCodeChange={handleVerificationCodeChange}
                          onConfirmCode={handleConfirmVerificationCode}
                        />
                      </div>
                    </div>

                    <div className="mt-auto hidden pt-5 sm:flex sm:items-center sm:gap-3">
                      <button
                        type="button"
                        onClick={handleBack}
                        className="flex h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.035)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/45"
                      >
                        ← Back
                      </button>
                      <div className="flex-1">
                        <PrimaryButton type="submit" disabled={loading}>
                          {loading ? "Launching..." : "Launch my shop"}
                        </PrimaryButton>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </form>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/95 px-4 py-3 shadow-[0_-18px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur sm:hidden">
        <div className="mx-auto max-w-[680px]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="text-xs font-semibold text-slate-600"
            >
              Your shop preview
            </button>
            <p className="text-xs font-medium text-slate-400">
              Free to start • No setup fees
            </p>
          </div>
          {step === 1 ? (
            <PrimaryButton
              type="button"
              disabled={!isStepOneValid}
              onClick={handleContinue}
            >
              Continue
            </PrimaryButton>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.035)] transition active:scale-[0.98]"
              >
                ← Back
              </button>
              <div className="flex-1">
                <PrimaryButton
                  type="submit"
                  form="business-onboarding-form"
                  disabled={loading}
                >
                  {loading ? "Launching..." : "Launch my shop"}
                </PrimaryButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {previewOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm sm:hidden">
          <button
            type="button"
            aria-label="Close preview"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setPreviewOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-[#fbf9ff] p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
            <ShopPreview
              name={previewName}
              type={previewType}
              description={previewDescription}
              location={previewLocation}
              imageSrc={previewImageSrc}
              pulse={previewPulse}
              compact
            />
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes onboardingStepSlide {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <style jsx global>{`
        @keyframes dropdownFadeSlide {
          from {
            opacity: 0;
            transform: translateY(-3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function ShopPreview({
  name,
  type,
  description,
  location,
  imageSrc = DEFAULT_BUSINESS_PREVIEW_IMAGE,
  pulse,
  compact = false,
}) {
  return (
    <div
      className={[
        "max-w-[500px] rounded-[28px] bg-white shadow-[0_32px_90px_-56px_rgba(15,23,42,0.65)] transition duration-150",
        compact ? "max-w-none p-5" : "p-6 xl:p-7",
        pulse ? "scale-[1.01] shadow-[0_36px_96px_-54px_rgba(15,23,42,0.72)]" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-slate-900">Your shop preview</p>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Updates live
        </span>
      </div>

      <div className="relative mt-5 overflow-hidden rounded-2xl bg-slate-100">
        <Image
          src={imageSrc}
          alt=""
          width={720}
          height={420}
          className={[
            compact ? "h-28" : "h-44",
            "w-full object-cover brightness-[0.92] contrast-[0.96] saturate-[0.94] transition-opacity duration-150",
          ].join(" ")}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/14 via-transparent to-white/10" />
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {type}
          </span>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            {location}
          </span>
        </div>

        <h2 className="mt-3 break-words text-2xl font-semibold leading-tight tracking-normal text-slate-950">
          {name}
        </h2>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
          {description}
        </p>

        <p className="mt-5 text-xs font-medium text-slate-500">
          <span className="font-semibold text-slate-700">Almost ready</span>
          {" — add your details to publish"}
        </p>
      </div>
    </div>
  );
}

// ------------------------------
// Reusable inputs
// ------------------------------

function StepDots({ step }) {
  return (
    <div className="mt-3 flex h-6 items-center gap-2" aria-hidden="true">
      {[1, 2].map((item) => (
        <span
          key={item}
          className={[
            "h-2.5 w-2.5 rounded-full transition-colors duration-150",
            item <= step ? "bg-[#6e34ff]" : "bg-slate-200",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function PrimaryButton({ children, type = "button", disabled, onClick, form }) {
  return (
    <button
      type={type}
      form={form}
      disabled={disabled}
      onClick={onClick}
      className="flex h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#6e34ff] to-[#7b3ff2] px-5 text-[15px] font-semibold text-[#FFFFFF] shadow-[0_14px_28px_-22px_rgba(110,52,255,0.72)] transition duration-[120ms] ease-out hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/45 disabled:cursor-not-allowed disabled:from-[#ebe7f4] disabled:to-[#ebe7f4] disabled:text-[#9f96ad] disabled:shadow-none disabled:hover:brightness-100 disabled:active:scale-100"
    >
      {children}
    </button>
  );
}

function SectionHeading({ title }) {
  return (
    <h2 className="text-sm font-semibold leading-5 text-slate-900">
      {title}
    </h2>
  );
}

function NotificationsPhoneField({
  value,
  code,
  status,
  verificationError,
  error,
  onChange,
  onSendCode,
  onCodeChange,
  onConfirmCode,
}) {
  const isVerified = status === "verified";
  const isSending = status === "sending";
  const isEnteringCode = status === "enter_code" || status === "error";
  const hasError = Boolean(error || verificationError);
  const inputClassName = [
    "h-11 w-full rounded-xl border bg-white px-4 text-base text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.035)]",
    "placeholder:text-slate-400 outline-none transition focus:outline-none focus:ring-0 focus:shadow-[0_0_0_2px_rgba(110,52,255,0.15)]",
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:shadow-[0_0_0_2px_rgba(244,63,94,0.14)]"
      : "border-slate-200/80 focus:border-[#6e34ff]",
  ].join(" ");
  const buttonClassName =
    "inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/45 disabled:cursor-not-allowed";

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-800">
        Notifications phone <span className="ml-0.5 text-rose-500">*</span>
      </label>

      <div className="flex items-center gap-1.5">
        <input
          type="tel"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder=""
          className={inputClassName}
          aria-invalid={hasError}
        />

        {isVerified ? (
          <span className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Verified
          </span>
        ) : (
          <button
            type="button"
            onClick={onSendCode}
            disabled={isSending}
            className={`${buttonClassName} bg-[#7b3ff2] text-[#FFFFFF] shadow-[0_8px_18px_-16px_rgba(110,52,255,0.72)] hover:bg-[#6e34ff] disabled:bg-[#ebe7f4] disabled:text-[#9f96ad] disabled:shadow-none disabled:hover:bg-[#ebe7f4]`}
          >
            {isSending ? "Sending..." : "Verify"}
          </button>
        )}
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-400">
        Verify your phone to receive SMS order notifications. Not shown to customers.
      </p>

      {isEnteringCode ? (
        <div className="mt-1 flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            placeholder="123456"
            className={`${inputClassName} flex-1 tracking-[0.18em]`}
            aria-label="Verification code"
          />
          <button
            type="button"
            onClick={onConfirmCode}
            className={`${buttonClassName} w-auto border border-slate-200 bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.035)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950`}
          >
            Confirm
          </button>
        </div>
      ) : null}

      {hasError ? (
        <p className="mt-2.5 text-xs font-medium leading-5 text-rose-600">
          {error || verificationError}
        </p>
      ) : null}
    </div>
  );
}

function FormField({
  label,
  value,
  placeholder,
  onChange,
  onFocus,
  type = "text",
  required = false,
  listId,
  helper,
  error,
  maxLength,
  options,
  large = false,
}) {
  const hasError = Boolean(error);
  const inputClassName = [
    "w-full rounded-xl border bg-white px-4 text-base text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.035)]",
    large ? "h-[52px]" : "h-11",
    "placeholder:text-slate-400 outline-none transition focus:outline-none focus:ring-0 focus:shadow-[0_0_0_2px_rgba(110,52,255,0.15)]",
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:shadow-[0_0_0_2px_rgba(244,63,94,0.14)]"
      : "border-slate-200/80 focus:border-[#6e34ff]",
  ].join(" ");
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </label>
      {Array.isArray(options) && options.length ? (
        <CustomDropdown
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          placeholder={placeholder ?? "Select an option"}
          options={options}
          className={inputClassName}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          list={listId}
          required={required}
          maxLength={maxLength}
          className={inputClassName}
        />
      )}
      {helper && !hasError ? (
        <p className="mt-2.5 text-xs leading-5 text-slate-500">{helper}</p>
      ) : null}
      {hasError ? (
        <p className="mt-2.5 text-xs font-medium leading-5 text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}

function CustomDropdown({ value, onChange, onFocus, placeholder, options, className }) {
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function openMenu() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
    onFocus?.();
  }

  function selectOption(option) {
    onChange(option.value);
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        const next = current + direction;
        if (next < 0) return options.length - 1;
        if (next >= options.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex(options.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const option = options[activeIndex];
      if (option) selectOption(option);
    }
  }

  return (
    <div className="relative overflow-visible" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${className} flex items-center justify-between gap-3 text-left`}
      >
        <span
          className={[
            "min-w-0 flex-1 truncate",
            selectedOption ? "text-slate-950" : "text-slate-400",
          ].join(" ")}
        >
          {selectedOption?.label || placeholder}
        </span>
        <svg
          aria-hidden="true"
          className={[
            "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150",
            open ? "rotate-180" : "",
          ].join(" ")}
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="m5 7.5 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white py-1.5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)] [animation:dropdownFadeSlide_120ms_ease-out]"
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const active = index === activeIndex;
            return (
              <button
                key={option.value}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
                className={[
                  "flex h-9 w-full items-center justify-between gap-3 px-3 text-left text-sm transition",
                  active ? "bg-purple-50/70" : "bg-white",
                  selected ? "font-semibold text-[#6e34ff]" : "font-medium text-slate-700",
                ].join(" ")}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {selected ? (
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 text-[#6e34ff]"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="m4.5 10.5 3.2 3.2 7.8-7.8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function FormTextArea({
  label,
  value,
  placeholder,
  onChange,
  rows = 3,
  required = false,
  action,
  error,
}) {
  const hasError = Boolean(error);
  const textareaClassName = [
    "h-24 w-full resize-none rounded-xl border bg-white px-4 py-3 text-base text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.035)]",
    "placeholder:text-slate-400 outline-none transition focus:outline-none focus:ring-0 focus:shadow-[0_0_0_2px_rgba(110,52,255,0.15)]",
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:shadow-[0_0_0_2px_rgba(244,63,94,0.14)]"
      : "border-slate-200/80 focus:border-[#6e34ff]",
  ].join(" ");
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="block text-sm font-semibold text-slate-800">
          {label}
          {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
        </label>
        {action}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className={textareaClassName}
      />
      {hasError ? (
        <p className="mt-2.5 text-xs font-medium leading-5 text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}

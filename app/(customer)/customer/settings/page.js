"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import CustomerAccountShell from "@/components/customer/CustomerAccountShell";
import SafeAvatar from "@/components/SafeAvatar";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getAuthProviderLabel,
  getPrimaryAuthProvider,
} from "@/lib/getAuthProvider";
import {
  Field,
  FieldGrid,
  SettingsSection,
} from "@/components/settings/SettingsSection";
import ManagePasswordDialog from "@/components/settings/ManagePasswordDialog";
import { US_STATES } from "@/lib/constants/usStates";
import { normalizeStateCode } from "@/lib/location/normalizeStateCode";
import {
  formatUSPhone,
  isIncompleteUSPhone,
  normalizeUSPhoneForStorage,
} from "@/lib/utils/formatUSPhone";
import {
  getCustomerProfileActionLabel,
  getCustomerProfileCompletion,
} from "@/lib/customer/profile-completion";
import {
  getVisibleCustomerSettingsAddressErrors,
  normalizeCustomerSettingsAddressPayload,
  validateCustomerSettingsAddress,
} from "@/lib/customer/settings-address-validation";

const editableSections = new Set(["profile", "address"]);
const focusFieldToSection = {
  fullName: "profile",
  phone: "profile",
  streetAddress: "address",
};

const settingsPanelClassName =
  "divide-y divide-slate-100 overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.035)]";
const sectionRowClassName =
  "!rounded-none !border-0 !bg-transparent !p-6 !shadow-none sm:!p-8";
const sectionHeaderClassName =
  "mb-5 gap-4 pb-0";
const sectionTitleClassName = "text-[1.05rem] font-semibold text-slate-950";
const sectionDescriptionClassName =
  "mt-1 max-w-2xl text-sm leading-6 text-slate-500";
const sectionBodyClassName = "space-y-5";
const sectionFooterClassName =
  "mt-6 border-t border-slate-100 pt-4 sm:justify-end";
const customerInputClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-violet-500 focus-visible:ring-4 focus-visible:ring-violet-500/15";
const readOnlyFieldClassName =
  "flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 text-sm text-slate-700";
const fieldLabelClassName = "font-medium text-slate-800";
const fieldHelperClassName = "text-slate-500";
const fieldErrorClassName = "text-rose-600";
const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center rounded-lg border border-slate-100 bg-white/70 px-3.5 text-sm font-medium text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClassName =
  "yb-primary-button inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/20 disabled:cursor-not-allowed";

function SectionActionButton({ children, ...props }) {
  return (
    <button type="button" className={secondaryButtonClassName} {...props}>
      {children}
    </button>
  );
}

function SectionSaveButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`${primaryButtonClassName} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function ReadOnlyField({
  value,
  emptyLabel = "Not added yet",
  actionLabel = "",
  onAction = null,
}) {
  const hasValue = Boolean(String(value || "").trim());
  return (
    <div
      className={`${readOnlyFieldClassName} ${
        hasValue ? "" : "justify-between gap-3 text-slate-500"
      }`}
    >
      <span className="min-w-0 break-words">{hasValue ? value : emptyLabel}</span>
      {!hasValue && actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 text-sm font-semibold text-violet-700 transition hover:text-violet-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/25"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function ProfileCompletionCard({ completion, onPrimaryAction }) {
  if (!completion || completion.missingFields.length === 0) return null;
  const actionLabel = getCustomerProfileActionLabel(completion.nextRecommendedAction);

  return (
    <div className="mb-5 rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.035)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            Complete your profile
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Add a few details for faster checkout, order updates, and pickup coordination.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 w-40 max-w-[45vw] overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-violet-600 transition-all"
                style={{ width: `${completion.completionPercent}%` }}
              />
            </div>
            <span className="text-sm font-medium text-slate-600">
              {completion.completedCount} of {completion.totalCount} complete
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onPrimaryAction}
          className="yb-primary-button inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/20"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function mergeProfile(baseProfile, nextProfile) {
  return {
    ...(baseProfile || {}),
    ...(nextProfile || {}),
  };
}

function getProfileSyncSignature(profile) {
  if (!profile?.id) return "";
  return JSON.stringify({
    id: profile.id,
    updated_at: profile.updated_at || "",
    full_name: profile.full_name || "",
    phone: profile.phone || "",
    city: profile.city || "",
    address: profile.address || "",
    address_2: profile.address_2 || "",
    state: profile.state || "",
    postal_code: profile.postal_code || "",
    profile_photo_url: profile.profile_photo_url || "",
  });
}

function StatePicker({ id, value, onChange, invalid = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedState = US_STATES.find((state) => state.code === value);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleButtonKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => {
        const activeOption =
          rootRef.current?.querySelector("[aria-selected='true']") ||
          rootRef.current?.querySelector("[role='option']");
        activeOption?.focus();
      });
    }
  };

  const handleOptionKeyDown = (event, stateCode) => {
    const options = Array.from(
      rootRef.current?.querySelectorAll("[role='option']") || []
    );
    const index = options.indexOf(event.currentTarget);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      options[Math.min(index + 1, options.length - 1)]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      options[Math.max(index - 1, 0)]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onChange(stateCode);
      setOpen(false);
      rootRef.current?.querySelector("button[aria-haspopup='listbox']")?.focus();
    } else if (event.key === "Escape") {
      setOpen(false);
      rootRef.current?.querySelector("button[aria-haspopup='listbox']")?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        data-invalid={invalid ? "true" : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleButtonKeyDown}
        className={`${customerInputClassName} flex items-center justify-between text-left ${
          value ? "text-slate-900" : "text-slate-400"
        } ${
          invalid
            ? "border-rose-400 focus-visible:border-rose-500 focus-visible:ring-rose-500/15"
            : ""
        }`}
      >
        <span>{selectedState ? selectedState.name : "State"}</span>
        <span aria-hidden="true" className="text-xs text-slate-400">
          v
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-labelledby={id}
          className="absolute z-30 mt-2 max-h-64 w-full min-w-56 overflow-auto rounded-xl border border-slate-100 bg-white p-1 shadow-[0_14px_34px_rgba(15,23,42,0.12)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            tabIndex={0}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            onKeyDown={(event) => handleOptionKeyDown(event, "")}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/25 ${
              !value
                ? "bg-violet-50 text-violet-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            State
          </button>
          {US_STATES.map((stateOption) => (
            <button
              key={stateOption.code}
              type="button"
              role="option"
              aria-selected={value === stateOption.code}
              tabIndex={-1}
              onClick={() => {
                onChange(stateOption.code);
                setOpen(false);
              }}
              onKeyDown={(event) => handleOptionKeyDown(event, stateOption.code)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/25 ${
                value === stateOption.code
                  ? "bg-violet-50 text-violet-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <span>{stateOption.name}</span>
              <span className="text-xs text-slate-400">{stateOption.code}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SettingsPage() {
  const { user, profile, supabase, loadingUser, logout, refreshProfile, updateProfile } =
    useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const effectiveProfile = useMemo(
    () =>
      profile ||
      (user
        ? {
            id: user.id,
            email: user.email || null,
            full_name: user.user_metadata?.full_name || null,
            profile_photo_url: user.user_metadata?.avatar_url || null,
            phone: null,
            city: null,
            address: null,
            address_2: null,
            state: null,
            postal_code: null,
          }
        : null),
    [profile, user]
  );

  /* -----------------------------------------------------------
     HOOKS (always first — no conditional hooks)
  ----------------------------------------------------------- */
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [managePasswordOpen, setManagePasswordOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const [pendingFocusField, setPendingFocusField] = useState(null);
  const [addressTouchedFields, setAddressTouchedFields] = useState({});
  const [addressSaveAttempted, setAddressSaveAttempted] = useState(false);
  const toastTimerRef = useRef(null);
  const handledCompleteProfileParamRef = useRef(false);
  const fullNameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const streetAddressInputRef = useRef(null);

  const buildInitialForm = (userValue) => ({
    full_name: userValue?.full_name || "",
    phone: formatUSPhone(userValue?.phone || ""),
    city: userValue?.city || "",
    address: userValue?.address || "",
    address_2: userValue?.address_2 || "",
    state: normalizeStateCode(userValue?.state) || "",
    postal_code: userValue?.postal_code || "",
    profile_photo_url: userValue?.profile_photo_url || "",
  });

  const [liveProfile, setLiveProfile] = useState(() => effectiveProfile);
  const currentProfile = liveProfile || effectiveProfile;
  const [form, setForm] = useState(() => buildInitialForm(currentProfile));
  const lastFormProfileSignatureRef = useRef("");

  const showToast = (type, message) => {
    setToast({ type, message });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const beginSectionEdit = (sectionKey) => {
    if (!editableSections.has(sectionKey) || saving) return;
    setActiveSection(sectionKey);
    setFieldErrors({});
    if (sectionKey === "address") {
      setAddressTouchedFields({});
      setAddressSaveAttempted(false);
    }
  };

  const beginSectionEditWithFocus = useCallback((sectionKey, focusField) => {
    if (!editableSections.has(sectionKey) || saving) return;
    setActiveSection(sectionKey);
    setPendingFocusField(focusField);
    setFieldErrors({});
    if (sectionKey === "address") {
      setAddressTouchedFields({});
      setAddressSaveAttempted(false);
    }
  }, [saving]);

  const cancelSectionEdit = () => {
    setActiveSection(null);
    setPendingFocusField(null);
    setForm(buildInitialForm(currentProfile));
    setFieldErrors({});
    setAddressTouchedFields({});
    setAddressSaveAttempted(false);
  };

  const handleFieldChange = (key, value) => {
    const nextValue = key === "phone" ? formatUSPhone(value) : value;
    setForm((prev) => ({
      ...prev,
      [key]: nextValue,
    }));
    setFieldErrors((prev) => {
      const nextForm = {
        ...form,
        [key]: nextValue,
      };
      if (
        ["address", "address_2", "city", "state", "postal_code"].includes(key) &&
        Object.keys(validateCustomerSettingsAddress(nextForm)).length === 0
      ) {
        const next = { ...prev };
        delete next.address;
        delete next.city;
        delete next.state;
        delete next.postal_code;
        return next;
      }

      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleAddressFieldBlur = (key) => {
    setAddressTouchedFields((prev) => ({
      ...prev,
      [key]: true,
    }));
    setFieldErrors((prev) => ({
      ...prev,
      ...validateCustomerSettingsAddress(form),
    }));
  };

  const visibleAddressErrors = getVisibleCustomerSettingsAddressErrors(
    fieldErrors,
    addressTouchedFields,
    addressSaveAttempted
  );
  const getAddressFieldError = (key) => {
    return visibleAddressErrors[key];
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  /* -----------------------------------------------------------
     LOAD PROFILE INTO FORM
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!effectiveProfile?.id) return;
    setLiveProfile((prev) => {
      if (!prev?.id || prev.id !== effectiveProfile.id) {
        return effectiveProfile;
      }

      const previousUpdatedAt = Date.parse(prev.updated_at || "");
      const nextUpdatedAt = Date.parse(effectiveProfile.updated_at || "");
      if (
        Number.isFinite(previousUpdatedAt) &&
        Number.isFinite(nextUpdatedAt) &&
        previousUpdatedAt > nextUpdatedAt
      ) {
        return prev;
      }

      return mergeProfile(prev, effectiveProfile);
    });
  }, [effectiveProfile]);

  useEffect(() => {
    if (!currentProfile?.id) return;
    if (activeSection) return;
    const nextSignature = getProfileSyncSignature(currentProfile);
    if (lastFormProfileSignatureRef.current === nextSignature) return;
    lastFormProfileSignatureRef.current = nextSignature;
    queueMicrotask(() => {
      setForm(buildInitialForm(currentProfile));
    });
  }, [activeSection, currentProfile]);

  useEffect(() => {
    if (!pendingFocusField) return undefined;
    const expectedSection = focusFieldToSection[pendingFocusField];
    if (expectedSection && activeSection !== expectedSection) return undefined;

    const inputByField = {
      fullName: fullNameInputRef,
      phone: phoneInputRef,
      streetAddress: streetAddressInputRef,
    };
    const targetRef = inputByField[pendingFocusField];
    let timeoutId = null;
    const frameId = requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        const target = targetRef?.current;
        if (!target) return;
        const shouldScrollTargetIntoView = pendingFocusField === "streetAddress";
        if (shouldScrollTargetIntoView) {
          const navOffset = 112;
          const top = target.getBoundingClientRect().top + window.scrollY - navOffset;
          window.scrollTo({
            top: Math.max(0, top),
            behavior: "smooth",
          });
        }
        target.focus({ preventScroll: true });
        setPendingFocusField(null);
      }, 0);
    });

    return () => {
      cancelAnimationFrame(frameId);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeSection, pendingFocusField]);

  useEffect(() => {
    if (loadingUser) return;
    if (!user) {
      router.replace("/");
    }
  }, [loadingUser, router, user]);

  /* -----------------------------------------------------------
     SAVE CHANGES
  ----------------------------------------------------------- */
  async function handleSave() {
    if (!user) return;
    const normalizedAddress = normalizeCustomerSettingsAddressPayload(form);
    const validationErrors = validateCustomerSettingsAddress(normalizedAddress);
    if (activeSection === "address") {
      setAddressSaveAttempted(true);
    }
    if (isIncompleteUSPhone(form.phone)) {
      validationErrors.phone = "Enter a complete 10-digit US phone number.";
    }

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      if (activeSection !== "address" || Object.keys(validationErrors).some((key) => key === "phone")) {
        showToast("error", "Fix the highlighted fields.");
      }
      return;
    }

    setSaving(true);
    setFieldErrors({});

    const profilePayload =
      activeSection === "address"
        ? {
            city: normalizedAddress.city || null,
            address: normalizedAddress.address || null,
            address_2: normalizedAddress.address_2 || null,
            state: normalizedAddress.state || null,
            postal_code: normalizedAddress.postal_code || null,
          }
        : {
            full_name: form.full_name,
            phone: normalizeUSPhoneForStorage(form.phone),
            profile_photo_url: form.profile_photo_url,
          };

    try {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload),
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok) {
        const updatedProfile = mergeProfile(currentProfile, payload?.profile);
        setLiveProfile(updatedProfile);
        setForm(buildInitialForm(updatedProfile));
        lastFormProfileSignatureRef.current = getProfileSyncSignature(updatedProfile);
        setAddressTouchedFields({});
        setAddressSaveAttempted(false);
        setActiveSection(null);
        setSaving(false);
        updateProfile?.(updatedProfile);
        refreshProfile?.();
        showToast("success", "Settings updated.");
        return;
      }

      setSaving(false);
      showToast("error", payload?.error || "Failed to save settings.");
    } catch {
      setSaving(false);
      showToast("error", "Failed to save settings.");
    }
  }

  /* -----------------------------------------------------------
     DELETE ACCOUNT
  ----------------------------------------------------------- */
  async function handleDeleteAccount() {
    if (!user) return;
    setDeleteConfirmText("");
    setDeleteModalOpen(true);
  }

  async function confirmDeleteAccount() {
    if (!user || deletePending) return;
    setDeletePending(true);
    try {
      const response = await fetch("/api/settings/request-account-deletion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmationText: deleteConfirmText,
          confirmationEmail: user.email || undefined,
          reason: "user_initiated",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete account.");
      }

      showToast("success", "Your account has been deleted.");
      setDeleteModalOpen(false);
      await logout({
        redirectTo: "/account-deleted",
        reason: "account_deletion_requested",
      });
    } catch (error) {
      showToast("error", error?.message || "Failed to delete account.");
    } finally {
      setDeletePending(false);
    }
  }

  /* -----------------------------------------------------------
     PHOTO UPLOAD
  ----------------------------------------------------------- */
  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);

    const fileName = `${user.id}-${Date.now()}`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(fileName, file);

    if (!error) {
      supabase.storage.from("avatars").getPublicUrl(fileName);

      setForm((prev) => ({
        ...prev,
        profile_photo_url: `avatars/${fileName}`,
      }));
    }

    setPhotoUploading(false);
  }

  /* -----------------------------------------------------------
     CHANGE DETECTION
  ----------------------------------------------------------- */
  const hasChanges =
    currentProfile &&
    JSON.stringify(form) !==
      JSON.stringify(buildInitialForm(currentProfile));

  const primaryProvider = getPrimaryAuthProvider(user);
  const providerLabel = getAuthProviderLabel(user);
  const userEmail = user?.email || profile?.email || "";
  const providerName = primaryProvider
    ? primaryProvider === "email" || primaryProvider === "google"
      ? userEmail || "Email"
      : primaryProvider.charAt(0).toUpperCase() + primaryProvider.slice(1)
    : userEmail || "Email";
  const isEditingProfile = activeSection === "profile";
  const isEditingAddress = activeSection === "address";
  const isEditingAnySection = activeSection !== null;
  const profileCompletion = useMemo(
    () => getCustomerProfileCompletion(currentProfile),
    [currentProfile]
  );
  const displayForm = useMemo(() => buildInitialForm(currentProfile), [currentProfile]);
  const beginProfileCompletionAction = useCallback(() => {
    const nextAction = profileCompletion.nextRecommendedAction;
    if (!nextAction) return;
    if (nextAction === "address") {
      beginSectionEditWithFocus("address", "streetAddress");
      return;
    }
    if (nextAction === "phone") {
      beginSectionEditWithFocus("profile", "phone");
      return;
    }
    beginSectionEditWithFocus("profile", "fullName");
  }, [beginSectionEditWithFocus, profileCompletion.nextRecommendedAction]);

  useEffect(() => {
    if (loadingUser || !user?.id) return;
    if (handledCompleteProfileParamRef.current) return;
    if (searchParams?.get("complete") !== "profile") return;

    handledCompleteProfileParamRef.current = true;
    beginProfileCompletionAction();

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("complete");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`
      );
    }
  }, [beginProfileCompletionAction, loadingUser, searchParams, user?.id]);

  /* -----------------------------------------------------------
     DEBUG (dev only) — trace provider sources
  ----------------------------------------------------------- */
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const storedLoginMethod = (() => {
      try {
        return localStorage.getItem("loginMethod");
      } catch {
        return null;
      }
    })();

    const storedProvider = (() => {
      try {
        return localStorage.getItem("provider");
      } catch {
        return null;
      }
    })();

    console.debug("[Settings:customer] login debug", {
      resolvedProvider: primaryProvider,
      providerLabel,
      sessionUserId: user?.id,
      sessionUserEmail: user?.email,
      app_metadata: user?.app_metadata,
      user_metadata: user?.user_metadata,
      profileProvider: {
        provider: profile?.provider,
        auth_provider: profile?.auth_provider,
        signup_method: profile?.signup_method,
      },
      storedLoginMethod,
      storedProvider,
    });
  }, [primaryProvider, profile, providerLabel, user]);

  /* -----------------------------------------------------------
     UI GUARD
  ----------------------------------------------------------- */
  if (loadingUser) {
    return <div className="min-h-screen bg-[#f6f7fb]" />;
  }

  if (!user) {
    return null;
  }

  /* -----------------------------------------------------------
     UI START
  ----------------------------------------------------------- */
  return (
    <div
      data-account-utility-bg="soft"
      className="min-h-screen bg-[#f6f7fb] text-slate-900"
    >
      <div className="pb-12 sm:pb-16">
        <CustomerAccountShell className="!bg-transparent">
          <div className="mb-7">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Settings
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Manage your profile, address, and account access.
              </p>
            </div>
          </div>

          <ProfileCompletionCard
            completion={profileCompletion}
            onPrimaryAction={beginProfileCompletionAction}
          />

          <div className={settingsPanelClassName}>
          <SettingsSection
            title="Profile"
            description="Keep your personal details current for orders, receipts, and support."
            action={
              <SectionActionButton
                onClick={() => beginSectionEdit("profile")}
                disabled={isEditingAnySection && !isEditingProfile}
              >
                {isEditingProfile ? "Editing" : "Edit"}
              </SectionActionButton>
            }
            footer={
              isEditingProfile ? (
                <>
                  <button
                    type="button"
                    onClick={cancelSectionEdit}
                    className={secondaryButtonClassName}
                  >
                    Cancel
                  </button>
                  <SectionSaveButton
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </SectionSaveButton>
                </>
              ) : null
            }
            className={sectionRowClassName}
            headerClassName={sectionHeaderClassName}
            bodyClassName={sectionBodyClassName}
            footerClassName={sectionFooterClassName}
            titleClassName={sectionTitleClassName}
            descriptionClassName={sectionDescriptionClassName}
          >
            <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-start">
              <div className="flex items-start gap-4 lg:flex-col">
                  <SafeAvatar
                    src={
                      isEditingProfile
                        ? form?.profile_photo_url || currentProfile?.profile_photo_url || ""
                        : displayForm.profile_photo_url
                    }
                    userMetadata={user?.user_metadata}
                    fullName={isEditingProfile ? form?.full_name || currentProfile?.full_name : displayForm.full_name}
                    displayName={isEditingProfile ? form?.full_name || currentProfile?.full_name : displayForm.full_name}
                    email={userEmail}
                    alt="Profile photo"
                    width={144}
                    height={144}
                    className="h-20 w-20 border border-slate-100 object-cover shadow-sm sm:h-24 sm:w-24"
                    initialsClassName="text-2xl sm:text-3xl"
                  />
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-sm font-semibold text-slate-900">
                      Profile photo
                    </p>
                    <p className="text-xs leading-5 text-slate-500">
                      Used across your account and order activity.
                    </p>
                  </div>
                  {isEditingProfile ? (
                    <label className={`${secondaryButtonClassName} cursor-pointer`}>
                      {photoUploading ? "Uploading..." : "Change photo"}
                      <input
                        type="file"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={photoUploading}
                      />
                    </label>
                  ) : null}
              </div>

              <div className="space-y-5">
                <FieldGrid className="gap-5 sm:grid-cols-2">
                  <Field
                    label="Full name"
                    id="full_name"
                    labelClassName={fieldLabelClassName}
                    helperClassName={fieldHelperClassName}
                    errorClassName={fieldErrorClassName}
                  >
                    {isEditingProfile ? (
                      <input
                        id="full_name"
                        ref={fullNameInputRef}
                        type="text"
                        value={form.full_name}
                        onChange={(e) =>
                          handleFieldChange("full_name", e.target.value)
                        }
                        className={customerInputClassName}
                      />
                    ) : (
                      <ReadOnlyField
                        value={displayForm.full_name}
                        actionLabel="Add name"
                        onAction={() => beginSectionEditWithFocus("profile", "fullName")}
                      />
                    )}
                  </Field>

                  <Field
                    label="Your phone number"
                    id="phone"
                    error={fieldErrors.phone}
                    labelClassName={fieldLabelClassName}
                    helperClassName={fieldHelperClassName}
                    errorClassName={fieldErrorClassName}
                  >
                    {isEditingProfile ? (
                      <input
                        id="phone"
                        ref={phoneInputRef}
                        type="tel"
                        value={form.phone}
                        onChange={(e) =>
                          handleFieldChange("phone", e.target.value)
                        }
                        className={customerInputClassName}
                      />
                    ) : (
                      <ReadOnlyField
                        value={displayForm.phone}
                        actionLabel="Add phone"
                        onAction={() => beginSectionEditWithFocus("profile", "phone")}
                      />
                    )}
                  </Field>
                </FieldGrid>

                <Field
                  label="Email"
                  id="email"
                  labelClassName={fieldLabelClassName}
                  helperClassName={fieldHelperClassName}
                  errorClassName={fieldErrorClassName}
                >
                  <ReadOnlyField value={userEmail} emptyLabel="Not available" />
                </Field>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Address"
            description="Keep your address accurate for faster delivery coordination and recommendations."
            action={
              <SectionActionButton
                onClick={() => beginSectionEdit("address")}
                disabled={isEditingAnySection && !isEditingAddress}
              >
                {isEditingAddress ? "Editing" : "Edit"}
              </SectionActionButton>
            }
            footer={
              isEditingAddress ? (
                <>
                  <button
                    type="button"
                    onClick={cancelSectionEdit}
                    className={secondaryButtonClassName}
                  >
                    Cancel
                  </button>
                  <SectionSaveButton
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </SectionSaveButton>
                </>
              ) : null
            }
            className={sectionRowClassName}
            headerClassName={sectionHeaderClassName}
            bodyClassName={sectionBodyClassName}
            footerClassName={sectionFooterClassName}
            titleClassName={sectionTitleClassName}
            descriptionClassName={sectionDescriptionClassName}
          >
            <FieldGrid className="gap-4 sm:grid-cols-2">
              <Field
                label="Street address"
                id="address"
                error={getAddressFieldError("address")}
                labelClassName={fieldLabelClassName}
                helperClassName={fieldHelperClassName}
                errorClassName={fieldErrorClassName}
                hideEmptyHelper
              >
                {isEditingAddress ? (
                  <input
                    id="address"
                    ref={streetAddressInputRef}
                    type="text"
                    value={form.address}
                    onChange={(e) =>
                      handleFieldChange("address", e.target.value)
                    }
                    onBlur={() => handleAddressFieldBlur("address")}
                    placeholder="Street address"
                    className={`${customerInputClassName} ${
                      getAddressFieldError("address")
                        ? "border-rose-400 focus-visible:border-rose-500 focus-visible:ring-rose-500/15"
                        : ""
                    }`}
                    aria-invalid={Boolean(getAddressFieldError("address"))}
                  />
                ) : (
                  <ReadOnlyField
                    value={displayForm.address}
                    actionLabel="Add address"
                    onAction={() => beginSectionEditWithFocus("address", "streetAddress")}
                  />
                )}
              </Field>

              <Field
                label="Apt / Suite / Unit"
                id="address_2"
                labelClassName={fieldLabelClassName}
                helperClassName={fieldHelperClassName}
                errorClassName={fieldErrorClassName}
                hideEmptyHelper
              >
                {isEditingAddress ? (
                  <input
                    id="address_2"
                    type="text"
                      value={form.address_2}
                      onChange={(e) =>
                        handleFieldChange("address_2", e.target.value)
                      }
                      onBlur={() => handleAddressFieldBlur("address_2")}
                      placeholder="Apt, suite, unit"
                    className={customerInputClassName}
                  />
                ) : (
                  <ReadOnlyField value={displayForm.address_2} emptyLabel="Optional" />
                )}
              </Field>
            </FieldGrid>

            <FieldGrid className="mt-6 gap-4 sm:grid-cols-3">
              <Field
                label="City"
                id="city"
                error={getAddressFieldError("city")}
                labelClassName={fieldLabelClassName}
                helperClassName={fieldHelperClassName}
                errorClassName={fieldErrorClassName}
                hideEmptyHelper
              >
                {isEditingAddress ? (
                  <input
                    id="city"
                    type="text"
                    value={form.city}
                    onChange={(e) => handleFieldChange("city", e.target.value)}
                    onBlur={() => handleAddressFieldBlur("city")}
                    placeholder="City"
                    className={`${customerInputClassName} ${
                      getAddressFieldError("city")
                        ? "border-rose-400 focus-visible:border-rose-500 focus-visible:ring-rose-500/15"
                        : ""
                    }`}
                    aria-invalid={Boolean(getAddressFieldError("city"))}
                  />
                ) : (
                  <ReadOnlyField value={displayForm.city} />
                )}
              </Field>

              <Field
                label="State"
                id="state"
                error={getAddressFieldError("state")}
                labelClassName={fieldLabelClassName}
                helperClassName={fieldHelperClassName}
                errorClassName={fieldErrorClassName}
                hideEmptyHelper
              >
                {isEditingAddress ? (
                  <StatePicker
                    id="state"
                    value={form.state}
                    onChange={(nextValue) => {
                      handleFieldChange("state", nextValue);
                      handleAddressFieldBlur("state");
                    }}
                    invalid={Boolean(getAddressFieldError("state"))}
                  />
                ) : (
                  <ReadOnlyField value={displayForm.state} />
                )}
              </Field>

              <Field
                label="Postal code"
                id="postal_code"
                error={getAddressFieldError("postal_code")}
                labelClassName={fieldLabelClassName}
                helperClassName={fieldHelperClassName}
                errorClassName={fieldErrorClassName}
                hideEmptyHelper
              >
                {isEditingAddress ? (
                  <input
                    id="postal_code"
                    type="text"
                    value={form.postal_code}
                    onChange={(e) =>
                      handleFieldChange("postal_code", e.target.value)
                    }
                    onBlur={() => handleAddressFieldBlur("postal_code")}
                    placeholder="Postal code"
                    className={`${customerInputClassName} ${
                      getAddressFieldError("postal_code")
                        ? "border-rose-400 focus-visible:border-rose-500 focus-visible:ring-rose-500/15"
                        : ""
                    }`}
                    aria-invalid={Boolean(getAddressFieldError("postal_code"))}
                  />
                ) : (
                  <ReadOnlyField value={displayForm.postal_code} />
                )}
              </Field>
            </FieldGrid>
          </SettingsSection>

          <SettingsSection
            title="Security"
            description="Manage how you access your account."
            className={sectionRowClassName}
            headerClassName={sectionHeaderClassName}
            bodyClassName={sectionBodyClassName}
            titleClassName={sectionTitleClassName}
            descriptionClassName={sectionDescriptionClassName}
          >
            <div className="flex flex-col gap-4 rounded-xl bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  Password & login
                </p>
                <p className="text-sm text-slate-600">
                  Signed in via {providerLabel}
                  {providerName ? ` · ${providerName}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManagePasswordOpen(true)}
                className={secondaryButtonClassName}
              >
                Manage
              </button>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Delete account"
            description="This permanently removes your access to YourBarrio and starts account deletion."
            className={sectionRowClassName}
            headerClassName={sectionHeaderClassName}
            bodyClassName={sectionBodyClassName}
            titleClassName="text-[1.05rem] font-semibold text-rose-700"
            descriptionClassName="mt-1 max-w-2xl text-sm leading-6 text-slate-500"
          >
            <div className="flex flex-col gap-4 rounded-xl border border-rose-100/80 bg-rose-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                This action cannot be undone. Use it only if you want to permanently delete this account.
              </p>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-200 bg-white px-3.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/15"
              >
                Delete account
              </button>
            </div>
          </SettingsSection>
          </div>
        </CustomerAccountShell>
      </div>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.type === "success"
                ? "bg-emerald-500 text-white"
                : "bg-rose-500 text-white"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}

      <ManagePasswordDialog
        open={managePasswordOpen}
        onClose={() => setManagePasswordOpen(false)}
        supabase={supabase}
        user={user}
        onSuccess={(message) => showToast("success", message)}
      />

      {deleteModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title-customer"
        >
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl transition-all duration-150 ease-out">
            <h2 id="delete-account-title-customer" className="text-xl font-semibold text-gray-900">
              Delete account permanently?
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              This action is permanent and cannot be undone. Once you delete your account, you will immediately lose access to YourBarrio.
            </p>
            <p className="mt-3 text-sm font-medium text-red-600">This action cannot be undone.</p>
            <label className="mt-5 block text-sm font-medium text-gray-800">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm.
              <input
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/30"
                autoComplete="off"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deletePending}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAccount}
                disabled={deletePending || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
                className="rounded-xl border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 disabled:opacity-50"
              >
                {deletePending ? "Deleting..." : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

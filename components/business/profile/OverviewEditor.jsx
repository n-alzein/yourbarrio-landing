"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BUSINESS_CATEGORIES } from "@/lib/businessCategories";

const DESCRIPTION_MIN = 30;

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const SOCIAL_FIELDS = [
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/" },
  { key: "x", label: "X (Twitter)", placeholder: "https://x.com/" },
];

function toObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function filterPayloadByProfile(payload, profile) {
  if (!profile) return {};
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) =>
      Object.prototype.hasOwnProperty.call(profile, key)
    )
  );
}

export default function OverviewEditor({
  profile,
  tone,
  editMode,
  setEditMode,
  onProfileUpdate,
  onToast,
}) {
  const { supabase, authUser, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [savingMessage, setSavingMessage] = useState("");

  const [form, setForm] = useState({
    business_name: "",
    category: "",
    description: "",
    website: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    hours: {},
    socials: {},
    profile_photo_url: "",
    cover_photo_url: "",
  });

  useEffect(() => {
    if (!profile) return;
    const hours = toObject(profile.hours_json);
    const socials = toObject(profile.social_links_json);
    setForm({
      business_name: profile.business_name || profile.full_name || "",
      category: profile.category || "",
      description: profile.description || "",
      website: profile.website || "",
      phone: profile.phone || "",
      email: profile.email || "",
      address: profile.address || "",
      city: profile.city || "",
      hours,
      socials,
      profile_photo_url: profile.profile_photo_url || "",
      cover_photo_url: profile.cover_photo_url || "",
    });
    setIsDirty(false);
  }, [profile]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    const hours = toObject(profile.hours_json);
    const socials = toObject(profile.social_links_json);
    const comparison = {
      business_name: profile.business_name || profile.full_name || "",
      category: profile.category || "",
      description: profile.description || "",
      website: profile.website || "",
      phone: profile.phone || "",
      email: profile.email || "",
      address: profile.address || "",
      city: profile.city || "",
      hours,
      socials,
      profile_photo_url: profile.profile_photo_url || "",
      cover_photo_url: profile.cover_photo_url || "",
    };
    return JSON.stringify(comparison) !== JSON.stringify(form);
  }, [profile, form]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setIsDirty(true);
  };

  const handleHourChange = (dayKey) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      hours: { ...prev.hours, [dayKey]: value },
    }));
    setIsDirty(true);
  };

  const handleSocialChange = (key) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      socials: { ...prev.socials, [key]: value },
    }));
    setIsDirty(true);
  };

  const buildHoursPayload = () => {
    const entries = {};
    DAYS.forEach(({ key }) => {
      const value = form.hours?.[key];
      if (value && value.trim()) {
        entries[key] = value.trim();
      }
    });
    return Object.keys(entries).length ? entries : null;
  };

  const buildSocialsPayload = () => {
    const entries = {};
    SOCIAL_FIELDS.forEach(({ key }) => {
      const value = form.socials?.[key];
      if (value && value.trim()) {
        entries[key] = value.trim();
      }
    });
    return Object.keys(entries).length ? entries : null;
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!form.business_name.trim()) nextErrors.business_name = "Business name is required.";
    if (!form.category.trim()) nextErrors.category = "Category is required.";
    if (!form.city.trim()) nextErrors.city = "City is required.";
    if (!form.description.trim() || form.description.trim().length < DESCRIPTION_MIN) {
      nextErrors.description = `Description must be at least ${DESCRIPTION_MIN} characters.`;
    }

    setErrors(nextErrors);
    return {
      isValid: Object.keys(nextErrors).length === 0,
    };
  };

  const handleSave = async () => {
    if (!authUser || !supabase) {
      onToast?.("error", "Session not ready. Please refresh and try again.");
      return;
    }
    const validation = validateForm();
    if (!validation.isValid) return;
    if (saving) return;

    const payload = {
      business_name: form.business_name.trim(),
      full_name: form.business_name.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      website: form.website.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      hours_json: buildHoursPayload(),
      social_links_json: buildSocialsPayload(),
      profile_photo_url: form.profile_photo_url.trim(),
      cover_photo_url: form.cover_photo_url.trim(),
    };
    const filteredPayload = filterPayloadByProfile(payload, profile);
    if (!Object.keys(filteredPayload).length) {
      onToast?.(
        "error",
        "Profile fields are not available in the users table schema."
      );
      return;
    }

    const previous = profile;
    onProfileUpdate?.({ ...profile, ...filteredPayload });
    setSaving(true);
    setSavingMessage("Saving profile...");

    try {
      const { data, error } = await supabase
        .from("users")
        .update(filteredPayload)
        .eq("id", authUser.id)
        .select("*")
        .maybeSingle();

      if (error) {
        onProfileUpdate?.(previous);
        onToast?.("error", error.message || "Failed to save profile.");
        return;
      }
      if (!data) {
        onProfileUpdate?.(previous);
        onToast?.("error", "Profile update failed to return data.");
        return;
      }

      onProfileUpdate?.(data);
      refreshProfile?.();
      setEditMode(false);
      setIsDirty(false);
      onToast?.("success", "Profile updated.");
    } catch (err) {
      onProfileUpdate?.(previous);
      onToast?.("error", err.message || "Failed to save profile.");
    } finally {
      setSaving(false);
      setSavingMessage("");
    }
  };

  const inputClass = `w-full rounded-xl border px-4 py-2 text-sm focus:outline-none focus:ring-4 ${tone.input}`;
  const labelClass = `text-xs font-semibold uppercase tracking-[0.18em] ${tone.textSoft}`;

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border ${tone.cardBorder} ${tone.cardSoft} p-5 md:p-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className={`text-lg font-semibold ${tone.textStrong}`}>Overview</h2>
            <p className={`text-sm ${tone.textMuted}`}>
              Keep your profile current so customers can find you faster.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditMode((prev) => !prev)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${tone.buttonSecondary}`}
            >
              {editMode ? "Close editor" : "Edit profile"}
            </button>
            {editMode ? (
              <button
                type="button"
                disabled={!(hasChanges || isDirty) || saving}
                onClick={handleSave}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${tone.buttonSecondary} ${
                  !(hasChanges || isDirty) || saving ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {saving ? savingMessage || "Saving..." : "Save changes"}
              </button>
            ) : null}
          </div>
        </div>

      </div>

      {editMode ? (
        <div className={`rounded-xl border ${tone.cardBorder} ${tone.cardSoft} p-5 md:p-6`}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Business name</label>
              <input
                type="text"
                value={form.business_name}
                onChange={handleChange("business_name")}
                className={inputClass}
              />
              {errors.business_name ? (
                <p className={tone.errorText}>{errors.business_name}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={form.category}
                onChange={handleChange("category")}
                className={inputClass}
              >
                <option value="">Select a category</option>
                {BUSINESS_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {errors.category ? (
                <p className={tone.errorText}>{errors.category}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input
                type="text"
                value={form.city}
                onChange={handleChange("city")}
                className={inputClass}
              />
              {errors.city ? <p className={tone.errorText}>{errors.city}</p> : null}
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={handleChange("phone")}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={handleChange("email")}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Website</label>
              <input
                type="url"
                value={form.website}
                onChange={handleChange("website")}
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Address</label>
              <input
                type="text"
                value={form.address}
                onChange={handleChange("address")}
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea
                value={form.description}
                onChange={handleChange("description")}
                rows={4}
                className={inputClass}
              />
              {errors.description ? (
                <p className={tone.errorText}>{errors.description}</p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Hours</label>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {DAYS.map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <p className={`text-xs font-semibold ${tone.textMuted}`}>{label}</p>
                    <input
                      type="text"
                      value={form.hours?.[key] || ""}
                      onChange={handleHourChange(key)}
                      className={inputClass}
                      placeholder="9am - 5pm"
                    />
                  </div>
                ))}
              </div>
              <p className={`mt-2 text-xs ${tone.textMuted}`}>
                Optional. Use a simple format customers can read.
              </p>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Social links</label>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1">
                    <p className={`text-xs font-semibold ${tone.textMuted}`}>{label}</p>
                    <input
                      type="url"
                      value={form.socials?.[key] || ""}
                      onChange={handleSocialChange(key)}
                      className={inputClass}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>
              <p className={`mt-2 text-xs ${tone.textMuted}`}>
                Optional. Add only the profiles you want to show.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className={`rounded-xl border ${tone.cardBorder} ${tone.cardSoft} p-5 md:p-6`}>
          <div className="grid gap-4 md:grid-cols-2">
            <InfoItem label="Business name" value={form.business_name} tone={tone} />
            <InfoItem label="Category" value={form.category} tone={tone} />
            <InfoItem label="City" value={form.city} tone={tone} />
            <InfoItem label="Phone" value={form.phone || "—"} tone={tone} />
            <InfoItem label="Email" value={form.email || "—"} tone={tone} />
            <InfoItem label="Website" value={form.website || "—"} tone={tone} />
            <div className="md:col-span-2">
              <InfoItem label="Address" value={form.address || "—"} tone={tone} />
            </div>
            <div className="md:col-span-2">
              <InfoItem label="Description" value={form.description} tone={tone} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, tone }) {
  return (
    <div className="space-y-1">
      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${tone.textSoft}`}>
        {label}
      </p>
      <p className={`text-sm ${tone.textStrong}`}>{value}</p>
    </div>
  );
}

function allowButtonStyle(tone) {
  return `${tone.buttonSecondary} text-xs`;
}

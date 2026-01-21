"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import FastImage from "@/components/FastImage";
import { useRouter } from "next/navigation";
import {
  getAuthProviderLabel,
  getPrimaryAuthProvider,
} from "@/lib/getAuthProvider";

export default function SettingsPage() {
  const { user, profile, supabase, loadingUser, logout, refreshProfile } =
    useAuth();
  const router = useRouter();

  /* -----------------------------------------------------------
     HOOKS (always first — no conditional hooks)
  ----------------------------------------------------------- */
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const buildInitialForm = (userValue) => ({
    full_name: userValue?.full_name || "",
    phone: userValue?.phone || "",
    city: userValue?.city || "",
    address: userValue?.address || "",
    profile_photo_url: userValue?.profile_photo_url || "",
  });

  const [form, setForm] = useState(() => buildInitialForm(profile));
  const lastUserIdRef = useRef(null);

  /* -----------------------------------------------------------
     LOAD PROFILE INTO FORM
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!profile?.id) return;
    if (lastUserIdRef.current === profile.id) return;
    lastUserIdRef.current = profile.id;
    queueMicrotask(() => {
      setForm(buildInitialForm(profile));
    });
  }, [profile]);

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
    setSaving(true);

    const { error } = await supabase
      .from("users")
      .update({
        full_name: form.full_name,
        phone: form.phone,
        city: form.city,
        address: form.address,
        profile_photo_url: form.profile_photo_url,
      })
      .eq("id", user.id);

    setSaving(false);
    setEditMode(false);

    if (!error) refreshProfile();
  }

  /* -----------------------------------------------------------
     DELETE ACCOUNT
  ----------------------------------------------------------- */
  async function handleDeleteAccount() {
    if (!user) return;

    if (!confirm("Are you sure you want to permanently delete your account?"))
      return;

    await supabase.from("users").delete().eq("id", user.id);
    await supabase.auth.admin.deleteUser(user.id);

    logout();
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
    profile &&
    JSON.stringify(form) !==
      JSON.stringify(buildInitialForm(profile));

  const primaryProvider = getPrimaryAuthProvider(user);
  const providerLabel = getAuthProviderLabel(user);
  const userEmail = user?.email || profile?.email || "";
  const providerName = primaryProvider
    ? primaryProvider === "email" || primaryProvider === "google"
      ? userEmail || "Email"
      : primaryProvider.charAt(0).toUpperCase() + primaryProvider.slice(1)
    : userEmail || "Email";

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

    console.debug("[Settings:customer] auth provider debug", {
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
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 rounded-full border-4 border-white/10 border-t-white/70 animate-spin mx-auto" />
          <p className="text-lg text-white/70">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  /* -----------------------------------------------------------
     UI START
  ----------------------------------------------------------- */
  return (
    <div className="min-h-screen pt-0 pb-20 text-white relative">

      {/* BACKGROUND */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
      </div>

      {/* MAIN CARD */}
      <div className="max-w-3xl mx-auto px-6">
        <div className="p-8 bg-white/10 border border-white/20 backdrop-blur-xl rounded-3xl shadow-2xl space-y-12">

          {/* PERSONAL DETAILS */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-medium">Personal Details</h2>

              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm"
                >
                  Edit
                </button>
              )}
            </div>

            {/* AVATAR */}
            <div className="flex flex-col items-center mb-8">
              <FastImage
                src={
                  (form?.profile_photo_url ||
                    profile?.profile_photo_url ||
                    "/customer-placeholder.png")
                }
                alt="Profile Photo"
                width={140}
                height={140}
                className="h-[140px] w-[140px] rounded-3xl border border-white/20 object-cover mb-3"
                sizes="140px"
                priority
              />

              {editMode && (
                <label className="cursor-pointer text-pink-400 hover:text-pink-300 text-sm">
                  Change Photo
                  <input type="file" className="hidden" onChange={handlePhotoUpload} />
                </label>
              )}
            </div>

            {/* FIELDS */}
            <div className="space-y-4">
              {[
                ["full_name", "Full Name"],
                ["phone", "Phone Number"],
                ["city", "City"],
                ["address", "Address"],
              ].map(([key, label]) => (
                <div key={key} className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <p className="text-sm text-white/60 mb-1">{label}</p>

                  {editMode ? (
                    <input
                      type="text"
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                      className="w-full bg-transparent border border-white/20 rounded-lg px-3 py-2 text-white"
                    />
                  ) : (
                    <p className="text-base text-white/90">
                      {form[key] || "—"}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* SAVE / CANCEL */}
            {editMode && (
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className={`px-5 py-2 rounded-lg text-sm transition ${
                    hasChanges
                      ? "bg-white text-black hover:bg-gray-200"
                      : "bg-white/20 text-white/40 cursor-not-allowed"
                  }`}
                >
                  {saving ? "Saving..." : "Save"}
                </button>

                <button
                  onClick={() => {
                    setEditMode(false);
                    setForm({
                      full_name: profile?.full_name || "",
                      phone: profile?.phone || "",
                      city: profile?.city || "",
                      address: profile?.address || "",
                      profile_photo_url: profile?.profile_photo_url || "",
                    });
                  }}
                  className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </section>

          {/* CONNECTED ACCOUNTS */}
          <section className="mt-10">
            <h2 className="text-xl font-medium mb-3">Connected Accounts</h2>

            <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-base text-white/90">{providerName}</p>
                <p className="text-white/60 text-sm">
                  Signed in via {providerLabel}
                </p>
              </div>

              <button
                disabled
                className="px-4 py-2 rounded-lg bg-white/5 text-white/40 cursor-not-allowed text-sm"
              >
                Manage
              </button>
            </div>
          </section>

          {/* DANGER ZONE */}
          <section className="pt-6 border-t border-white/10">
            <button
              onClick={handleDeleteAccount}
              className="text-red-400 text-sm hover:text-red-300 transition underline"
            >
              Delete Account Permanently
            </button>
          </section>

        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { authUser, user, supabase, loadingUser, logout, refreshProfile } =
    useAuth();
  const router = useRouter();
  const redirectPath = "/business-auth/login?redirect=/business/settings";

  /* -----------------------------------------------------------
     HOOKS (always first — no conditional hooks)
  ----------------------------------------------------------- */
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    city: "",
    address: "",
    profile_photo_url: "",
  });

  /* -----------------------------------------------------------
     AUTH GUARD — redirect when session drops instead of blank UI
  ----------------------------------------------------------- */
  useEffect(() => {
    if (loadingUser) return;
    if (authUser) return;

    router.replace(redirectPath);
  }, [authUser, loadingUser, router, redirectPath]);

  /* -----------------------------------------------------------
     LOAD PROFILE INTO FORM
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!user) return;

    setForm({
      full_name: user.full_name || "",
      phone: user.phone || "",
      city: user.city || "",
      address: user.address || "",
      profile_photo_url: user.profile_photo_url || "",
    });
  }, [user]);

  /* -----------------------------------------------------------
     SAVE CHANGES
  ----------------------------------------------------------- */
  async function handleSave() {
    if (!authUser) return;
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
      .eq("id", authUser.id);

    setSaving(false);
    setEditMode(false);

    if (!error) refreshProfile();
  }

  /* -----------------------------------------------------------
     DELETE ACCOUNT
  ----------------------------------------------------------- */
  async function handleDeleteAccount() {
    if (!authUser) return;

    if (!confirm("Are you sure you want to permanently delete your account?"))
      return;

    await supabase.from("users").delete().eq("id", authUser.id);
    await supabase.auth.admin.deleteUser(authUser.id);

    logout();
  }

  /* -----------------------------------------------------------
     PHOTO UPLOAD
  ----------------------------------------------------------- */
  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);

    const fileName = `${authUser.id}-${Date.now()}`;

    const { error } = await supabase.storage
      .from("customer-photos")
      .upload(fileName, file);

    if (!error) {
      const { data } = supabase.storage
        .from("customer-photos")
        .getPublicUrl(fileName);

      setForm((prev) => ({
        ...prev,
        profile_photo_url: data.publicUrl,
      }));
    }

    setPhotoUploading(false);
  }

  /* -----------------------------------------------------------
     CHANGE DETECTION
  ----------------------------------------------------------- */
  const hasChanges =
    user &&
    JSON.stringify(form) !==
      JSON.stringify({
        full_name: user.full_name || "",
        phone: user.phone || "",
        city: user.city || "",
        address: user.address || "",
        profile_photo_url: user.profile_photo_url || "",
      });

  /* -----------------------------------------------------------
     UI GUARD
  ----------------------------------------------------------- */
  if (loadingUser) {
    return <div className="min-h-screen bg-black" />;
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="space-y-3 text-center">
          <p className="text-lg font-semibold">Session expired</p>
          <p className="text-sm text-white/70">
            Please sign in again to keep managing your business account.
          </p>
          <button
            type="button"
            onClick={() => router.replace(redirectPath)}
            className="px-4 py-2 rounded-lg bg-white text-black font-semibold"
          >
            Go to login
          </button>
        </div>
      </div>
    );
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
              <Image
                src={
                  form.profile_photo_url ||
                  user.profile_photo_url ||
                  "/customer-placeholder.png"
                }
                alt="Profile Photo"
                width={140}
                height={140}
                className="rounded-3xl border border-white/20 object-cover mb-3"
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
                      full_name: user.full_name || "",
                      phone: user.phone || "",
                      city: user.city || "",
                      address: user.address || "",
                      profile_photo_url: user.profile_photo_url || "",
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
                <p className="text-base text-white/90">Google</p>
                <p className="text-white/60 text-sm">Signed in via Google OAuth</p>
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

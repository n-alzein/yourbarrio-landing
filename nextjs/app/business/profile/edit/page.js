"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabaseClient";

export default function BusinessProfileEdit() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [ownerId, setOwnerId] = useState(null);

  const [profile, setProfile] = useState({
    business_name: "",
    category: "",
    description: "",
    website: "",
    phone: "",
    address: "",
    city: "",
    profile_photo_url: "",
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const placeholderImage = "/business-placeholder.png";

  // ------------------------------------------
  // LOAD PROFILE
  // ------------------------------------------
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!userProfile) {
        console.error("No profiles row found!");
        return;
      }

      setOwnerId(userProfile.id);

      const { data: business } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("owner_id", userProfile.id)
        .maybeSingle();

      if (business) {
        setProfile(business);
        if (business.profile_photo_url) {
          setPhotoPreview(business.profile_photo_url);
        }
      }

      setLoading(false);
    }

    load();
  }, []);

  // ------------------------------------------
  // UPLOAD PHOTO
  // ------------------------------------------
  async function uploadPhoto() {
    if (!photoFile) return profile.profile_photo_url;

    const ext = photoFile.name.split(".").pop();
    const fileName = `${ownerId}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("business-photos")
      .upload(fileName, photoFile, {
        cacheControl: "3600",
        upsert: true,
        contentType: photoFile.type,
      });

    if (error) {
      console.error("Photo upload error:", error);
      alert("Failed to upload image");
      return profile.profile_photo_url;
    }

    const { data } = supabase.storage
      .from("business-photos")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  // ------------------------------------------
  // SAVE
  // ------------------------------------------
  async function handleSave() {
    if (!ownerId) return;

    setSaving(true);

    const photoUrl = await uploadPhoto();

    const payload = {
      owner_id: ownerId,
      business_name: profile.business_name || "",
      category: profile.category || "",
      description: profile.description || "",
      website: profile.website || "",
      phone: profile.phone || "",
      address: profile.address || "",
      city: profile.city || "",
      profile_photo_url: photoUrl || "",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("business_profiles")
      .upsert(payload, { onConflict: "owner_id" });

    if (error) {
      console.error("Save error:", error);
      alert("Failed to save profile");
      setSaving(false);
      return;
    }

    setSaving(false);
    router.push("/business/profile");
  }

  // ------------------------------------------
  // RENDER
  // ------------------------------------------
  if (loading)
    return <div className="text-white text-center mt-24">Loading…</div>;

  const displayPhoto = photoPreview || placeholderImage;

  return (
    <div className="max-w-2xl mx-auto mt-20 bg-white/10 backdrop-blur-xl p-10 rounded-3xl text-white border border-white/20">

      <h1 className="text-3xl font-bold mb-6">Edit Business Profile</h1>

      {/* ⭐ PREMIUM LOGO UPLOAD BOX */}
      <div className="flex justify-center mb-8">
        <label className="relative cursor-pointer group">
          <div className="w-40 h-40 bg-white/10 rounded-xl border border-white/20 shadow-lg flex items-center justify-center overflow-hidden">
            <img
              src={displayPhoto}
              alt="Business Logo"
              className="object-contain w-full h-full p-2"
            />
          </div>

          {/* 🔥 Overlay (appears on hover) */}
          <div
            className="
              absolute inset-0 rounded-xl bg-black/40 
              flex items-center justify-center 
              opacity-0 group-hover:opacity-100 
              transition-opacity
            "
          >
            <span className="text-sm font-medium text-white">
              Click to update logo
            </span>
          </div>

          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files[0];
              setPhotoFile(file);
              setPhotoPreview(URL.createObjectURL(file));
            }}
          />
        </label>
      </div>

      {/* FIELDS */}
      <Field label="Business Name" value={profile.business_name} onChange={(v) => setProfile({ ...profile, business_name: v })} />
      <Field label="Category" value={profile.category} onChange={(v) => setProfile({ ...profile, category: v })} />
      <Field label="Description" value={profile.description} onChange={(v) => setProfile({ ...profile, description: v })} />
      <Field label="Website" value={profile.website} onChange={(v) => setProfile({ ...profile, website: v })} />
      <Field label="Phone" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} />
      <Field label="Address" value={profile.address} onChange={(v) => setProfile({ ...profile, address: v })} />
      <Field label="City" value={profile.city} onChange={(v) => setProfile({ ...profile, city: v })} />

      {/* BUTTONS */}
      <div className="flex gap-4 mt-8">
        <button
          onClick={() => router.push("/business/profile")}
          className="flex-1 py-3 rounded-xl bg-white/20 border border-white/30"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 font-semibold hover:opacity-90"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------
// FIELD COMPONENT
// ------------------------------------------
function Field({ label, value, onChange }) {
  return (
    <div className="mb-6">
      <label className="block mb-1 text-sm font-semibold">{label}</label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg"
      />
    </div>
  );
}

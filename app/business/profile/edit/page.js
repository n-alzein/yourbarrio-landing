"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function BusinessProfileEdit() {
  const router = useRouter();

  const { supabase, authUser, user, role, loadingUser, refreshProfile } =
    useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  /* ----------------------------------------------------------
     SAFE AUTH GUARD + LOAD PROFILE (FROM user FIRST)
  ---------------------------------------------------------- */
  useEffect(() => {
    if (loadingUser) {
      return <div className="text-white">Loading...</div>;
    }
    
    if (!authUser) {
      router.push("/business-auth/login");
      return null;
    }
    

    if (role !== "business") {
      router.push("/profile");
      return;
    }

    async function load() {
      // 1️⃣ First try to hydrate from `user` (AuthProvider DB row)
      if (user) {
        setProfile({
          business_name: user.business_name ?? "",
          category: user.category ?? "",
          description: user.description ?? "",
          website: user.website ?? "",
          phone: user.phone ?? "",
          address: user.address ?? "",
          city: user.city ?? "",
          profile_photo_url: user.profile_photo_url ?? "",
        });

        if (user.profile_photo_url) {
          setPhotoPreview(user.profile_photo_url);
        }

        setLoading(false);
        return;
      }

      // 2️⃣ Fallback: fetch directly from Supabase if `user` is not set
      if (!authUser?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (error) {
        console.error("Error loading business profile:", error);
        setLoading(false);
        return;
      }

      if (data) {
        setProfile({
          business_name: data.business_name ?? "",
          category: data.category ?? "",
          description: data.description ?? "",
          website: data.website ?? "",
          phone: data.phone ?? "",
          address: data.address ?? "",
          city: data.city ?? "",
          profile_photo_url: data.profile_photo_url ?? "",
        });

        if (data.profile_photo_url) {
          setPhotoPreview(data.profile_photo_url);
        }
      }

      setLoading(false);
    }

    load();
  }, [loadingUser, authUser, role, user, supabase, router]);

  /* ----------------------------------------------------------
     UPLOAD PHOTO
  ---------------------------------------------------------- */
  const uploadPhoto = async (file) => {
    if (!file) return profile.profile_photo_url;

    if (!authUser || !authUser.id) {
      console.warn("Skipping photo upload: authUser not ready");
      return profile.profile_photo_url;
    }

    const ext = file.name.split(".").pop();
    const fileName = `${authUser.id}-${Date.now()}.${ext}`;
    const path = `business-photos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("business-photos")
      .upload(path, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return profile.profile_photo_url;
    }

    const { data } = supabase.storage
      .from("business-photos")
      .getPublicUrl(path);

    return data.publicUrl;
  };

  /* ----------------------------------------------------------
     SAVE CHANGES
  ---------------------------------------------------------- */
  async function handleSave() {
    setSaving(true);
  
    try {
      if (!authUser || !authUser.id) {
        alert("Session still loading. Try again.");
        return;
      }
  
      // Upload photo if needed
      const uploadedUrl = await uploadPhoto(photoFile);
  
      const payload = {
        business_name: profile.business_name,
        category: profile.category,
        description: profile.description,
        website: profile.website,
        phone: profile.phone,
        address: profile.address,
        city: profile.city,
        profile_photo_url: uploadedUrl,
        updated_at: new Date().toISOString(),
      };
  
      const { error } = await supabase
        .from("users")
        .update(payload)
        .eq("id", authUser.id);
  
      if (error) {
        console.error("Save error:", error);
        alert("Failed to save profile");
        return;
      }
  
      // ⭐ Make sure refreshProfile doesn't hang
      await Promise.race([
        refreshProfile(),
        new Promise((resolve) => setTimeout(resolve, 500)), // safety timeout
      ]);
  
      // Release button BEFORE redirect
      setSaving(false);
  
      router.push("/business/profile");
    } catch (e) {
      console.error(e);
      alert("Unexpected error");
      setSaving(false);
    }
  }
  

  /* ----------------------------------------------------------
     RENDER
  ---------------------------------------------------------- */
  // Do not render ANY UI until AuthProvider + local load are done
  if (loadingUser || loading) return null;

  const displayPhoto = photoPreview || placeholderImage;

  return (
    <div className="max-w-2xl mx-auto mt-20 bg-white/10 backdrop-blur-xl p-10 rounded-3xl text-white border border-white/20">
      <h1 className="text-3xl font-bold mb-6">Edit Business Profile</h1>

      {/* PHOTO UPLOAD */}
      <div className="flex justify-center mb-8">
        <label className="relative cursor-pointer group">
          <div className="w-40 h-40 rounded-xl bg-white/10 border border-white/20 shadow-lg overflow-hidden">
            <img
              src={displayPhoto}
              alt="Business Logo"
              className="object-cover w-full h-full"
            />
          </div>

          <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-sm font-medium text-white">
              Click to upload new logo
            </span>
          </div>

          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files[0];
              setPhotoFile(file);
              if (file) {
                setPhotoPreview(URL.createObjectURL(file));
              }
            }}
          />
        </label>
      </div>

      {/* FIELDS */}
      <Field
        label="Business Name"
        value={profile.business_name}
        onChange={(v) => setProfile({ ...profile, business_name: v })}
      />
      <Field
        label="Category"
        value={profile.category}
        onChange={(v) => setProfile({ ...profile, category: v })}
      />
      <Field
        label="Description"
        value={profile.description}
        onChange={(v) => setProfile({ ...profile, description: v })}
      />
      <Field
        label="Website"
        value={profile.website}
        onChange={(v) => setProfile({ ...profile, website: v })}
      />
      <Field
        label="Phone"
        value={profile.phone}
        onChange={(v) => setProfile({ ...profile, phone: v })}
      />
      <Field
        label="Address"
        value={profile.address}
        onChange={(v) => setProfile({ ...profile, address: v })}
      />
      <Field
        label="City"
        value={profile.city}
        onChange={(v) => setProfile({ ...profile, city: v })}
      />

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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/AuthProvider";

export default function CustomerProfileEditPage() {
  const router = useRouter();
  const { authUser, user, role, supabase, loadingUser } = useAuth();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    full_name: "",
    city: "",
    phone: "",
    description: "",
    profile_photo_url: "",
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const placeholder = "/business-placeholder.png";

  /* ------------------------------------------------------
     AUTH GUARD + LOAD PROFILE
  ------------------------------------------------------ */
  useEffect(() => {
    if (loadingUser) return;

    // Not logged in → go to login
    if (!authUser) {
      router.replace("/auth/login");
      return;
    }

    // Logged in but wrong role → send them elsewhere
    if (role && role !== "customer") {
      router.replace(role === "business" ? "/business/profile" : "/");
      return;
    }

    let isMounted = true;

    async function loadProfile() {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (!isMounted) return;

      if (error) {
        console.error("Failed to load customer profile:", error);
        setLoadingProfile(false);
        return;
      }

      setProfile({
        full_name: data.full_name ?? "",
        city: data.city ?? "",
        phone: data.phone ?? "",
        description: data.description ?? "",
        profile_photo_url: data.profile_photo_url ?? "",
      });

      setPreview(data.profile_photo_url || null);
      setLoadingProfile(false);
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [authUser, role, supabase, loadingUser, router]);

  /* ------------------------------------------------------
     SAVE PROFILE
  ------------------------------------------------------ */
  async function handleSave(e) {
    e.preventDefault();
    if (!authUser) return;

    setSaving(true);

    let finalPhotoUrl = profile.profile_photo_url;

    // Upload new photo if any
    if (photoFile) {
      const fileExt = photoFile.name.split(".").pop();
      const fileName = `${authUser.id}-${Date.now()}.${fileExt}`;

      // 👉 Use your existing bucket name here (e.g. "business-photos" or "profile-photos")
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, photoFile, {
          upsert: true,
        });

      if (uploadError) {
        console.error("Photo upload failed:", uploadError);
      } else {
        const {
          data: { publicUrl },
        } = supabase.storage.from("profile-photos").getPublicUrl(fileName);
        finalPhotoUrl = publicUrl;
      }
    }

    const { error } = await supabase
      .from("users")
      .update({
        full_name: profile.full_name,
        city: profile.city,
        phone: profile.phone,
        description: profile.description,
        profile_photo_url: finalPhotoUrl,
      })
      .eq("id", authUser.id);

    if (error) {
      console.error("Failed to save profile:", error);
      alert("Failed to save profile. Please try again.");
      setSaving(false);
      return;
    }

    router.replace("/customer/profile");
  }

  /* ------------------------------------------------------
     LOADING STATE
  ------------------------------------------------------ */
  if (loadingUser || loadingProfile) {
    return <div className="min-h-screen bg-black" />;
  }

  /* ------------------------------------------------------
     UI
  ------------------------------------------------------ */
  return (
    <div className="min-h-screen pt-28 pb-20 text-white relative">
      {/* BACKGROUND */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
        <div className="pointer-events-none absolute -top-24 -left-24 h-[380px] w-[380px] rounded-full bg-purple-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 -right-24 h-[460px] w-[460px] rounded-full bg-pink-500/30 blur-[130px]" />
      </div>

      {/* HEADER */}
      <div className="max-w-4xl mx-auto px-6 text-center mb-12">
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Edit{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
            Profile
          </span>
        </h1>
        <p className="text-white/70 text-lg">
          Keep your information up to date so YourBarrio can personalize your experience.
        </p>
      </div>

      {/* FORM CARD */}
      <div className="max-w-4xl mx-auto px-6">
        <form
          onSubmit={handleSave}
          className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-10 shadow-2xl space-y-10"
        >
          {/* PHOTO */}
          <div className="flex flex-col items-center gap-6">
            <Image
              src={preview || placeholder}
              alt="Profile Photo"
              width={150}
              height={150}
              className="rounded-2xl object-cover border border-white/20 shadow-xl"
            />

            <label className="cursor-pointer bg-white text-black px-6 py-2 rounded-xl font-semibold shadow hover:bg-gray-200 transition">
              Change Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPhotoFile(file);
                    setPreview(URL.createObjectURL(file));
                  }
                }}
              />
            </label>
          </div>

          {/* GRID FIELDS */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Full Name */}
            <div>
              <label className="block text-white/70 mb-2 text-sm">
                Full Name
              </label>
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) =>
                  setProfile({ ...profile, full_name: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:border-purple-400/50 focus:ring-2 focus:ring-purple-500/30 transition"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-white/70 mb-2 text-sm">City</label>
              <input
                type="text"
                value={profile.city}
                onChange={(e) =>
                  setProfile({ ...profile, city: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:border-purple-400/50 focus:ring-2 focus:ring-purple-500/30 transition"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-white/70 mb-2 text-sm">Phone</label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:border-purple-400/50 focus:ring-2 focus:ring-purple-500/30 transition"
              />
            </div>

            {/* Spacer / future field */}
            <div />
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="block text-white/70 mb-2 text-sm">
              About You
            </label>
            <textarea
              value={profile.description}
              onChange={(e) =>
                setProfile({ ...profile, description: e.target.value })
              }
              rows={5}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:border-purple-400/50 focus:ring-2 focus:ring-purple-500/30 transition resize-none"
              placeholder="Tell us a little about yourself, your favorite local spots, or what you’re looking for in YourBarrio..."
            />
          </div>

          {/* BUTTONS */}
          <div className="flex justify-between items-center gap-4">
            <button
              type="button"
              onClick={() => router.push("/customer/profile")}
              className="px-6 py-2 rounded-xl border border-white/30 text-white/80 hover:bg-white/10 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-10 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 shadow-[0_4px_20px_rgba(255,0,128,0.3)] hover:brightness-110 transition font-semibold text-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

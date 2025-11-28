"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabaseClient";

export default function BusinessProfileView() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);

  // Placeholder image (should exist under /public)
  const placeholderImage = "/business-placeholder.png";

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      // 1️⃣ Fetch profile row of the auth user
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!userProfile) {
        console.error("No profiles row found for user!");
        setLoading(false);
        return;
      }

      // 2️⃣ Fetch the business profile
      const { data: business } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("owner_id", userProfile.id)
        .maybeSingle();

      if (!business) {
        setLoading(false);
        router.push("/business/profile/edit");
        return;
      }

      setProfile(business);
      setLoading(false);
    }

    load();
  }, []);

  if (loading)
    return <div className="text-white text-center mt-24">Loading…</div>;

  if (!profile)
    return (
      <div className="text-white text-center mt-24">
        No business profile found.
      </div>
    );

  const photoToShow =
    profile.profile_photo_url &&
    profile.profile_photo_url.trim() !== "" &&
    profile.profile_photo_url !== "business photo"
      ? profile.profile_photo_url
      : placeholderImage;

  return (
    <div className="max-w-2xl mx-auto mt-20 bg-white/10 backdrop-blur-xl p-10 rounded-3xl text-white border border-white/20">

      <h1 className="text-3xl font-bold mb-6">Business Profile</h1>

      {/* ⭐ LOGO (Square, not Circle) */}
      <div className="flex justify-center mb-8">
        <div className="w-40 h-40 bg-white/10 rounded-xl border border-white/20 shadow-lg flex items-center justify-center overflow-hidden">
          <img
            src={photoToShow}
            alt="Business Logo"
            onError={(e) => {
              e.currentTarget.src = placeholderImage;
            }}
            className="object-contain w-full h-full p-2"
          />
        </div>
      </div>

      <ProfileRow label="Email" value={user.email} />
      <ProfileRow label="Business Name" value={profile.business_name} />
      <ProfileRow label="Category" value={profile.category} />
      <ProfileRow label="Website" value={profile.website} />
      <ProfileRow label="Phone" value={profile.phone} />
      <ProfileRow label="Description" value={profile.description} />
      <ProfileRow label="Address" value={profile.address} />
      <ProfileRow label="City" value={profile.city} />

      <button
        onClick={() => router.push("/business/profile/edit")}
        className="w-full mt-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 font-semibold hover:opacity-90 transition"
      >
        Edit Profile
      </button>
    </div>
  );
}

function ProfileRow({ label, value }) {
  return (
    <div className="mb-4">
      <p className="text-sm opacity-70">{label}</p>
      <p className="text-lg font-semibold">{value || "—"}</p>
    </div>
  );
}

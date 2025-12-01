"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function BusinessProfileView() {
  const router = useRouter();
  const { authUser, user, supabase, loadingUser, role } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const placeholderImage = "/business-placeholder.png";

  // ---------------------------------------------------------
  // 🔥 Fetch fresh profile from Supabase
  // ---------------------------------------------------------
  const loadProfile = useCallback(async () => {
    if (!authUser) return;

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (error) {
      console.error("Failed to load fresh user profile:", error);
      return;
    }

    setProfile(data);
  }, [authUser?.id, supabase]);

  // ---------------------------------------------------------
  // 🔥 Main auth guard + instant render
  // ---------------------------------------------------------
  useEffect(() => {
    if (loadingUser) return;

    if (!authUser) {
      router.push("/business-auth/login");
      return null;
    }
    

    if (role !== "business") {
      router.push("/profile");
      return;
    }

    if (user) {
      setProfile(user);
      setLoading(false);
    }

    loadProfile();
  }, [loadingUser, authUser, role, user, loadProfile, router]);

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------
  if (loading)
    return (
      <div className="text-white text-center mt-24">
        Loading…
      </div>
    );

  if (!profile)
    return (
      <div className="text-white text-center mt-24">
        No business profile found.
      </div>
    );

  const photo =
    profile.profile_photo_url && profile.profile_photo_url.trim() !== ""
      ? profile.profile_photo_url
      : placeholderImage;

  return (
    <div className="max-w-2xl mx-auto mt-12 bg-white/10 backdrop-blur-xl p-10 rounded-3xl text-white border border-white/20">
      <h1 className="text-3xl font-bold mb-6">Business Profile</h1>

      {/* UPDATED LOGO — NO BORDER, NO SQUARE, JUST IMAGE */}
      <div className="flex justify-center mb-8">
        <img
          src={photo}
          alt="Business Logo"
          className="object-cover w-40 h-40 rounded-xl"
          onError={(e) => (e.currentTarget.src = placeholderImage)}
        />
      </div>

      <ProfileRow label="Email" value={profile.email} />
      <ProfileRow label="Business Name" value={profile.business_name} />
      <ProfileRow label="Category" value={profile.category} />
      <ProfileRow label="Website" value={profile.website} />
      <ProfileRow label="Phone" value={profile.phone} />
      <ProfileRow label="Description" value={profile.description} />
      <ProfileRow label="Address" value={profile.address} />
      <ProfileRow label="City" value={profile.city} />

      <button
        onClick={() => router.push("/business/profile/edit")}
        className="w-full mt-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 font-semibold hover:opacity-90"
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

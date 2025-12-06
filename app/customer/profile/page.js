"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import Image from "next/image";
import Link from "next/link";

export default function CustomerProfilePage() {
  const { authUser, supabase, loadingUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [dbProfile, setDbProfile] = useState(null);

  const customerPlaceholder = "/customer-placeholder.png";

  /* --------------------------------------------------------------
     LOAD DATABASE PROFILE (if exists)
  -------------------------------------------------------------- */
  useEffect(() => {
    async function loadProfile() {
      if (!authUser) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (data) setDbProfile(data);
      setLoading(false);
    }

    loadProfile();
  }, [authUser, supabase]);

  if (loadingUser || loading) {
    return <div className="min-h-screen bg-black" />;
  }

  /* --------------------------------------------------------------
     MERGED CUSTOMER PROFILE
  -------------------------------------------------------------- */
  const merged = {
    id: authUser?.id,
    email: authUser?.email,

    full_name:
      dbProfile?.full_name ||
      authUser?.user_metadata?.full_name ||
      "Your Name",

    phone: dbProfile?.phone || "Not provided",
    city: dbProfile?.city || "Not provided",
    address: dbProfile?.address || "Not provided",

    profile_photo_url:
      dbProfile?.profile_photo_url ||
      authUser?.user_metadata?.avatar_url ||
      customerPlaceholder,

    created_at:
      dbProfile?.created_at ||
      authUser?.created_at ||
      new Date().toISOString(),
  };

  /* --------------------------------------------------------------
     UI
  -------------------------------------------------------------- */
  return (
    <div className="min-h-screen pt-32 pb-20 text-white relative">

      {/* --- Background Glow Layers --- */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#05010d]" />
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
        <div className="pointer-events-none absolute -top-24 -left-24 h-[380px] w-[380px] bg-purple-600/30 blur-[140px] rounded-full" />
        <div className="pointer-events-none absolute top-40 -right-24 h-[460px] w-[460px] bg-pink-500/30 blur-[140px] rounded-full" />
      </div>

      {/* --- Page Header --- */}
      <div className="max-w-6xl mx-auto px-6 text-center mb-16">
        <h1 className="text-5xl md:text-6xl font-bold mb-3 tracking-tight">
          Your{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
            Profile
          </span>
        </h1>
        <p className="text-white/70 text-lg">
          Manage your personal account details & preferences.
        </p>
      </div>

      {/* --- Profile Main Card --- */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="p-10 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">

          {/* --- Top Row with Photo + Basic Info --- */}
          <div className="flex flex-col md:flex-row gap-10 items-center md:items-start">

            {/* Profile Photo */}
            <div className="relative">
              <Image
                src={merged.profile_photo_url}
                alt="Profile Photo"
                width={180}
                height={180}
                className="rounded-3xl object-cover border border-white/20 shadow-xl"
              />

              <Link
                href="/customer/profile/edit"
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white text-black px-4 py-1 rounded-full text-sm font-semibold shadow-lg hover:bg-gray-200 transition"
              >
                Edit Photo
              </Link>
            </div>

            {/* Basic Info */}
            <div className="flex-1">
              <h2 className="text-4xl font-bold mb-2">{merged.full_name}</h2>

              <p className="text-white/60 text-lg mb-4">{merged.email}</p>

              {/* Member Since — only card now */}
              <div className="grid md:grid-cols-1 gap-6 w-full">

                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <p className="text-white/70 text-sm">Member Since</p>
                  <p className="text-xl font-semibold mt-1">
                    {new Date(merged.created_at).toLocaleDateString()}
                  </p>
                </div>

              </div>
            </div>
          </div>

          {/* --- Detailed Info Rows --- */}
          <div className="mt-12 grid md:grid-cols-2 gap-8">

            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <p className="text-white/70 text-sm">Phone Number</p>
              <p className="text-lg font-semibold mt-1">
                {merged.phone}
              </p>
            </div>

            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <p className="text-white/70 text-sm">City</p>
              <p className="text-lg font-semibold mt-1">
                {merged.city}
              </p>
            </div>

            <div className="bg-white/5 p-6 rounded-xl border border-white/10 col-span-full">
              <p className="text-white/70 text-sm">Address</p>
              <p className="text-lg font-semibold mt-1">
                {merged.address}
              </p>
            </div>

          </div>

          {/* EDIT BUTTON */}
          <div className="flex justify-center mt-12">
            <Link
              href="/customer/profile/edit"
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 shadow-[0_4px_20px_rgba(255,0,128,0.3)] hover:brightness-110 transition font-semibold"
            >
              Edit Profile Details
            </Link>
          </div>

        </div>
      </div>

      {/* --- Saved Businesses --- */}
      <div className="max-w-6xl mx-auto px-6 mt-20">
        <h2 className="text-3xl font-semibold mb-6">Your Saved Businesses</h2>

        <div className="text-center text-white/60 text-lg">
          You haven’t saved any businesses yet.
          <br />
          <Link
            href="/customer/businesses"
            className="text-pink-400 font-semibold hover:underline"
          >
            Explore local businesses →
          </Link>
        </div>
      </div>

    </div>
  );
}

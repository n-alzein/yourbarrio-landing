"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

function buildInitialProfile(authProfile) {
  return {
    full_name: authProfile?.full_name || "",
    role: authProfile?.role || "",
  };
}

function ProfileForm({ user, profile, supabase }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [profileState, setProfileState] = useState(() =>
    buildInitialProfile(profile)
  );

  async function handleSave(e) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage("");

    // Only update full_name, NOT role
    await supabase
      .from("users")
      .update({
        full_name: profileState.full_name,
      })
      .eq("id", user.id);

    setMessage("✔ Profile updated!");
    setSaving(false);
  }

  return (
    <div className="max-w-xl mx-auto mt-28 bg-white/10 backdrop-blur-xl p-8 rounded-2xl text-white border border-white/20">
      <h1 className="text-3xl font-bold mb-6">Your Profile</h1>

      {/* EMAIL (READ ONLY) */}
      <div className="mb-6">
        <label className="block mb-1 text-sm font-semibold">Email</label>
        <input
          disabled
          value={user.email}
          className="w-full p-3 bg-white/20 border border-white/20 rounded-lg text-white/70"
        />
      </div>

      {/* FULL NAME */}
      <div className="mb-6">
        <label className="block mb-1 text-sm font-semibold">Full Name</label>
        <input
          value={profileState.full_name}
          onChange={(e) =>
            setProfileState({ ...profileState, full_name: e.target.value })
          }
          className="w-full p-3 bg-white/10 border border-white/20 rounded-lg"
        />
      </div>

      {/* ROLE (READ ONLY) */}
      <div className="mb-6">
        <label className="block mb-1 text-sm font-semibold">Role</label>
          <input
          disabled
          value={profileState.role}
          className="w-full p-3 bg-white/20 border border-white/20 rounded-lg text-white/70"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 font-semibold"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>

      {message && <p className="mt-4 text-center">{message}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const { supabase, user, profile, loadingUser } = useAuth();

  if (loadingUser || !user) {
    return <div className="text-white text-center mt-24">Loading…</div>;
  }

  return (
    <ProfileForm
      key={user.id}
      user={user}
      profile={profile}
      supabase={supabase}
    />
  );
}

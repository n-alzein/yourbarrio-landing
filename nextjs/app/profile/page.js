"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function ProfilePage() {
  const router = useRouter();
  const { supabase } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({
    full_name: "",
    role: "",
  });

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      const { data: profileData } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile({
          full_name: profileData.full_name || "",
          role: profileData.role || "",
        });
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage("");

    // Only update full_name, NOT role
    await supabase
      .from("users")
      .update({
        full_name: profile.full_name,
      })
      .eq("id", user.id);

    setMessage("✔ Profile updated!");
    setSaving(false);
  }

  if (loading) {
    return <div className="text-white text-center mt-24">Loading…</div>;
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
          value={profile.full_name}
          onChange={(e) =>
            setProfile({ ...profile, full_name: e.target.value })
          }
          className="w-full p-3 bg-white/10 border border-white/20 rounded-lg"
        />
      </div>

      {/* ROLE (READ ONLY) */}
      <div className="mb-6">
        <label className="block mb-1 text-sm font-semibold">Role</label>
        <input
          disabled
          value={profile.role}
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

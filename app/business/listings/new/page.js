"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BUSINESS_CATEGORIES } from "@/lib/businessCategories";

export default function NewListingPage() {
  const { supabase, authUser, loadingUser } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
  });

  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);

  const MAX_PHOTOS = 10;

  const photoPreviews = useMemo(
    () => photos.map((file) => URL.createObjectURL(file)),
    [photos]
  );

  useEffect(
    () => () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    },
    [photoPreviews]
  );

  useEffect(() => {
    if (!loadingUser && !authUser) {
      router.push("/business");
    }
  }, [authUser, loadingUser, router]);

  const handleAddPhotos = (files) => {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;

    setPhotos((prev) => {
      const combined = [...prev, ...incoming].slice(0, MAX_PHOTOS);
      return combined;
    });
  };

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  async function uploadPhotos() {
    if (!photos.length) return [];
    if (!supabase) throw new Error("Connection not ready. Try again.");

    const uploaded = [];
    for (const file of photos) {
      const fileName = `${authUser.id}-${Date.now()}-${crypto
        .randomUUID?.()
        ?.slice(0, 6) || Math.random().toString(36).slice(2, 8)}-${file.name}`;

      const { data, error } = await supabase.storage
        .from("listing-photos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });

      if (error) {
        console.error("Photo upload failed", error);
        throw new Error("Failed to upload one of the photos");
      }

      const { data: url } = supabase.storage
        .from("listing-photos")
        .getPublicUrl(fileName);

      if (url?.publicUrl) {
        uploaded.push(url.publicUrl);
      }
    }

    return uploaded;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!supabase) {
      alert("Connection not ready. Please try again.");
      return;
    }

    if (!photos.length) {
      alert("Please add at least one photo (up to 10).");
      return;
    }

    setSaving(true);

    try {
      const photo_urls = await uploadPhotos();

      const { data: business, error: bizError } = await supabase
        .from("users")
        .select("city")
        .eq("id", authUser.id)
        .single();

      if (bizError) {
        throw bizError;
      }

      const { error } = await supabase.from("listings").insert({
        business_id: authUser.id,
        title: form.title,
        description: form.description,
        price: form.price,
        category: form.category,
        city: business?.city || null,
        photo_url: photo_urls.length ? JSON.stringify(photo_urls) : null,
      });

      if (error) {
        throw error;
      }

      router.push("/business/listings");
    } catch (err) {
      console.error("Publish listing failed", err);
      alert(err.message || "Failed to publish listing. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingUser) {
    return (
      <p className="text-white text-center py-20">
        Loading account...
      </p>
    );
  }

  if (!authUser) {
    return (
      <p className="text-white text-center py-20">
        Redirecting to login...
      </p>
    );
  }

  if (!supabase) {
    return (
      <p className="text-white text-center py-20">
        Connecting to your account...
      </p>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
      <div className="mb-16 text-center">
        <h1 className="text-5xl font-extrabold text-white drop-shadow-md">
          Create Listing
        </h1>
        <p className="text-gray-300 text-lg mt-4">
          Present your product or service with elegance and clarity.
        </p>
      </div>

      <div
        className="
          backdrop-blur-xl 
          bg-white/10 
          rounded-3xl 
          shadow-[0_8px_30px_rgb(0,0,0,0.25)] 
          p-12 
          border border-white/20
          space-y-10
        "
      >
        <form onSubmit={handleSubmit} className="space-y-10">

          {/* PHOTO UPLOAD GRID */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-white/80">
              <span className="font-semibold">Photos ({photos.length}/{MAX_PHOTOS})</span>
              <span className="text-sm text-white/60">Add up to 10 photos</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photoPreviews.map((src, idx) => (
                <div key={src} className="relative group">
                  <img
                    src={src}
                    alt={`Listing photo ${idx + 1}`}
                    className="w-full h-36 object-cover rounded-2xl border border-white/15"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition"
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {photos.length < MAX_PHOTOS && (
                <label
                  className="
                    h-36 flex flex-col items-center justify-center
                    rounded-2xl border-2 border-dashed border-white/30 
                    bg-white/5 text-gray-200 cursor-pointer hover:bg-white/10 transition
                  "
                >
                  <span className="text-sm font-semibold">Add photos</span>
                  <span className="text-xs text-white/70">PNG, JPG</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleAddPhotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <h2 className="text-2xl text-white font-semibold">
            Listing Details
          </h2>

          <input
            className="w-full px-5 py-4 rounded-2xl bg-white/15 text-white placeholder-gray-300 
                       focus:ring-4 focus:ring-blue-500/40 outline-none transition"
            placeholder="Listing Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />

          <textarea
            className="w-full px-5 py-4 rounded-2xl bg-white/15 text-white placeholder-gray-300 
                       focus:ring-4 focus:ring-blue-500/40 outline-none transition h-40"
            placeholder="Describe your product or service..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />

          <select
            className="w-full px-5 py-4 rounded-2xl bg-white/15 text-white 
                       focus:ring-4 focus:ring-blue-500/40 outline-none transition"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
          >
            <option value="" className="text-black">Select Category</option>
            {BUSINESS_CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="text-black">
                {cat}
              </option>
            ))}
          </select>

          <input
            className="w-full px-5 py-4 rounded-2xl bg-white/15 text-white 
                       placeholder-gray-300 focus:ring-4 focus:ring-blue-500/40 outline-none transition"
            type="number"
            placeholder="Price (ex: 49.99)"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />

          {/* BUTTONS SIDE BY SIDE */}
          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={() => router.push("/business/listings")}
              className="flex-1 py-5 rounded-2xl backdrop-blur-md bg-white/10 
                         border border-white/20 text-white text-lg font-medium
                         hover:bg-white/20 hover:border-white/30 transition"
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-5 rounded-2xl bg-gradient-to-r from-blue-600 
                         to-indigo-600 text-white text-lg font-semibold 
                         shadow-xl hover:opacity-90 transition"
            >
              {saving ? "Publishing..." : "Publish Listing"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

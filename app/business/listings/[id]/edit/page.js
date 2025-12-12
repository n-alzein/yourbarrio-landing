"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BUSINESS_CATEGORIES } from "@/lib/businessCategories";

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams();
  const listingId = params.id;

  const { supabase, authUser, loadingUser } = useAuth();

  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    city: "",
    photo_url: "",
  });

  const [photo, setPhoto] = useState(null);
  const [uploadName, setUploadName] = useState("");

  // Prevent early rendering
  if (loadingUser) {
    return <div className="text-white text-center py-20">Loading account...</div>;
  }

  if (!authUser) {
    router.push("/business-auth/login");
    return null;
  }
  

  // Load existing listing
  useEffect(() => {
    if (loadingUser || !authUser) return;

    async function loadListing() {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .single();

      if (error) {
        console.error("❌ Fetch listing error:", error);
        return;
      }

      setForm({
        title: data.title || "",
        description: data.description || "",
        price: data.price || "",
        category: data.category || "",
        city: data.city || "",
        photo_url: data.photo_url || "",
      });

      setLoading(false);
    }

    loadListing();
  }, [loadingUser, authUser]);

  async function uploadPhoto() {
    if (!photo) return form.photo_url; // Keep old photo if unchanged

    const fileName = `${authUser.id}-${Date.now()}-${photo.name}`;

    const { error } = await supabase.storage
      .from("listing-photos")
      .upload(fileName, photo, {
        contentType: photo.type,
        upsert: false,
        cacheControl: "3600",
      });

    if (error) {
      console.error("❌ Upload error:", error);
      alert("Failed to upload new photo.");
      return form.photo_url;
    }

    const { data: url } = supabase.storage
      .from("listing-photos")
      .getPublicUrl(fileName);

    return url.publicUrl;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const newPhotoUrl = await uploadPhoto();

    const { error } = await supabase
      .from("listings")
      .update({
        title: form.title,
        description: form.description,
        price: form.price,
        category: form.category,
        city: form.city,
        photo_url: newPhotoUrl,
      })
      .eq("id", listingId)
      .eq("business_id", authUser.id);

    if (error) {
      console.error("❌ Update error:", error);
      alert(error.message);
      return;
    }

    router.push("/business/listings");
  }

  if (loading) {
    return <div className="text-white text-center py-20">Loading listing...</div>;
  }

  // -------------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
      <h1 className="text-4xl font-bold text-white mb-10">Edit Listing</h1>

      <div className="backdrop-blur-xl bg-white/10 p-12 rounded-3xl border border-white/20 space-y-10">

        <form onSubmit={handleSubmit} className="space-y-10">

          {/* SQUARE PHOTO UPLOAD AT THE TOP */}
          <div className="flex justify-center">
            <label
              className="
                w-64 h-64
                flex flex-col items-center justify-center
                rounded-3xl 
                border-2 border-dashed border-white/40 
                bg-white/5 
                text-gray-200 
                cursor-pointer 
                hover:bg-white/10
                transition
                overflow-hidden
              "
            >
              {/* If new photo selected → show preview */}
              {photo ? (
                <img
                  src={URL.createObjectURL(photo)}
                  alt="Preview"
                  className="w-full h-full object-cover rounded-3xl"
                />
              ) : form.photo_url ? (
                <img
                  src={form.photo_url}
                  alt="Current photo"
                  className="w-full h-full object-cover rounded-3xl"
                />
              ) : (
                <>
                  <span className="text-lg">Upload New Photo</span>
                  {uploadName && (
                    <p className="mt-2 text-sm text-gray-300">{uploadName}</p>
                  )}
                </>
              )}

              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  setPhoto(e.target.files[0]);
                  setUploadName(e.target.files[0]?.name);
                }}
              />
            </label>
          </div>

          {/* FORM FIELDS */}
          <input
            className="
              w-full px-5 py-4 rounded-2xl bg-white/15 text-white placeholder-gray-300 
              focus:ring-4 focus:ring-blue-500/40 outline-none transition
            "
            placeholder="Listing Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />

          <textarea
            className="
              w-full px-5 py-4 rounded-2xl bg-white/15 text-white 
              placeholder-gray-300 focus:ring-4 focus:ring-blue-500/40 outline-none 
              transition h-40
            "
            placeholder="Description..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />

          <input
            className="
              w-full px-5 py-4 rounded-2xl bg-white/15 text-white 
              placeholder-gray-300 focus:ring-4 focus:ring-blue-500/40 outline-none transition
            "
            type="number"
            placeholder="Price (ex: 49.99)"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />

          <select
            className="
              w-full px-5 py-4 rounded-2xl bg-white/15 text-white 
              focus:ring-4 focus:ring-blue-500/40 outline-none transition
            "
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

          {/* BUTTONS SIDE BY SIDE */}
          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={() => router.push("/business/listings")}
              className="
                flex-1 py-5 rounded-2xl 
                backdrop-blur-md bg-white/10 
                border border-white/20 
                text-white text-lg font-medium
                hover:bg-white/20 hover:border-white/30 
                transition
              "
            >
              Cancel
            </button>

            <button
              type="submit"
              className="
                flex-1 py-5 rounded-2xl 
                bg-gradient-to-r from-blue-600 to-indigo-600 
                text-white text-lg font-semibold 
                shadow-xl hover:opacity-90 
                transition
              "
            >
              Save Changes
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

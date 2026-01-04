"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BUSINESS_CATEGORIES } from "@/lib/businessCategories";
import { extractPhotoUrls } from "@/lib/listingPhotos";

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams();
  const listingId = params.id;

  const { supabase, authUser, loadingUser } = useAuth();
  const REQUEST_TIMEOUT_MS = 60000;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const MAX_PHOTOS = 10;

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    city: "",
  });

  const [existingPhotos, setExistingPhotos] = useState([]);
  const [newPhotos, setNewPhotos] = useState([]);
  const newPhotoPreviews = useMemo(
    () => newPhotos.map((file) => ({ url: URL.createObjectURL(file) })),
    [newPhotos]
  );

  const withTimeout = async (promise, label) => {
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(label || "Request timed out. Please retry.")),
          REQUEST_TIMEOUT_MS
        );
      });
      const result = await Promise.race([promise, timeout]);
      return result;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  useEffect(
    () => () => {
      newPhotoPreviews.forEach(({ url }) => URL.revokeObjectURL(url));
    },
    [newPhotoPreviews]
  );

  // Load existing listing
  useEffect(() => {
    if (loadingUser || !authUser || !supabase || !listingId) return;

    async function loadListing() {
      const { data, error } = await withTimeout(
        supabase
          .from("listings")
          .select("*")
          .eq("id", listingId)
          .single(),
        "Loading listing timed out. Please retry."
      );

      if (error) {
        console.error("❌ Fetch listing error:", error);
        setLoading(false);
        return;
      }

      setForm({
        title: data.title || "",
        description: data.description || "",
        price: data.price || "",
        category: data.category || "",
        city: data.city || "",
      });
      setExistingPhotos(extractPhotoUrls(data.photo_url));

      setLoading(false);
    }

    loadListing();
  }, [loadingUser, authUser, supabase, listingId]);

  const handleAddNewPhotos = (files) => {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;

    const availableSlots =
      MAX_PHOTOS - existingPhotos.length - newPhotos.length;
    if (availableSlots <= 0) return;

    setNewPhotos((prev) => [
      ...prev,
      ...incoming.slice(0, Math.max(0, availableSlots)),
    ]);
  };

  const handleRemoveExisting = (index) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNew = (index) => {
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  async function uploadNewPhotos() {
    if (!newPhotos.length) return [];
    if (!supabase) throw new Error("Connection not ready. Try again.");

    const uploaded = [];

    for (const file of newPhotos) {
      const fileName = `${authUser.id}-${Date.now()}-${crypto
        .randomUUID?.()
        ?.slice(0, 6) || Math.random().toString(36).slice(2, 8)}-${
        file.name
      }`;

      const { error } = await withTimeout(
        supabase.storage.from("listing-photos").upload(fileName, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: "3600",
        }),
        "Uploading a photo timed out. Please retry."
      );

      if (error) {
        console.error("❌ Upload error:", error);
        throw new Error("Failed to upload one of the photos.");
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

    const resetTimer = setTimeout(() => setSaving(false), 20000);
    try {
      setSaving(true);

      const uploaded = await uploadNewPhotos();

      const photoUrls = [...existingPhotos, ...uploaded].slice(0, MAX_PHOTOS);

      if (!photoUrls.length) {
        alert("Please keep at least one photo.");
        return;
      }

      const payload = {
        title: (form.title || "").trim(),
        description: form.description || "",
        price: form.price,
        category: form.category,
        city: form.city,
        photo_url: JSON.stringify(photoUrls),
      };

      const { data, error } = await withTimeout(
        supabase
          .from("listings")
          .update(payload)
          .eq("id", listingId)
          .eq("business_id", authUser.id)
          .select("id")
          .single(),
        "Saving changes timed out. Please retry."
      );

      if (error) {
        throw error;
      }

      if (!data?.id) {
        throw new Error("Save did not complete. Please retry.");
      }

      setSaving(false);
      router.push("/business/listings");
    } catch (err) {
      console.error("❌ Update error:", err);
      alert(err.message || "Failed to save changes. Please try again.");
    } finally {
      clearTimeout(resetTimer);
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-white text-center py-20">Loading listing...</div>;
  }

  if (loadingUser) {
    return <div className="text-white text-center py-20">Loading account...</div>;
  }

  if (!authUser) {
    return <div className="text-white text-center py-20">Redirecting to login...</div>;
  }

  // -------------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
      <h1 className="text-4xl font-bold text-white mb-10">Edit Listing</h1>

      <div className="backdrop-blur-xl bg-white/10 p-12 rounded-3xl border border-white/20 space-y-10">

        <form onSubmit={handleSubmit} className="space-y-10">

          {/* PHOTO UPLOAD GRID */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-white/80">
              <span className="font-semibold">
                Photos ({existingPhotos.length + newPhotos.length}/{MAX_PHOTOS})
              </span>
              <span className="text-sm text-white/60">Add up to 10 photos</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {existingPhotos.map((src, idx) => (
                <div key={`${src}-${idx}`} className="relative group">
                  <img
                    src={src}
                    alt={`Listing photo ${idx + 1}`}
                    className="w-full h-36 object-cover rounded-2xl border border-white/15"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveExisting(idx)}
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition"
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {newPhotoPreviews.map((preview, idx) => (
                <div key={`new-${idx}`} className="relative group">
                  <img
                    src={preview.url}
                    alt={`New listing photo ${idx + 1}`}
                    className="w-full h-36 object-cover rounded-2xl border border-dashed border-white/15"
                  />
                  <span className="absolute left-2 top-2 text-[11px] px-2 py-1 rounded-full bg-black/60 text-white/80">
                    New
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveNew(idx)}
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition"
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {existingPhotos.length + newPhotos.length < MAX_PHOTOS && (
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
                      handleAddNewPhotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
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
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="
                flex-1 py-5 rounded-2xl 
                bg-gradient-to-r from-blue-600 to-indigo-600 
                text-white text-lg font-semibold 
                shadow-xl hover:opacity-90 
                transition
              "
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

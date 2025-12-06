"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function NewListingPage() {
  const { supabase, authUser, loadingUser } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
  });

  const [photo, setPhoto] = useState(null);
  const [uploadName, setUploadName] = useState("");

  if (loadingUser) {
    return (
      <p className="text-white text-center py-20">
        Loading account...
      </p>
    );
  }

  if (!authUser) {
    router.push("/business-auth/login");
    return null;
  }
  

  async function uploadPhoto() {
    if (!photo) return null;

    const fileName = `${authUser.id}-${Date.now()}-${photo.name}`;
    const { data, error } = await supabase.storage
      .from("listing-photos")
      .upload(fileName, photo, {
        cacheControl: "3600",
        upsert: false,
        contentType: photo.type || "image/jpeg",
      });

    if (error) {
      alert("Failed to upload photo");
      return null;
    }

    const { data: url } = supabase.storage
      .from("listing-photos")
      .getPublicUrl(fileName);

    return url.publicUrl;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const photo_url = await uploadPhoto();

    const { data: business } = await supabase
      .from("business_profiles")
      .select("city")
      .eq("owner_id", authUser.id)
      .single();

    const { error } = await supabase.from("listings").insert({
      business_id: authUser.id,
      title: form.title,
      description: form.description,
      price: form.price,
      category: form.category,
      city: business?.city || null,
      photo_url,
    });

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/business/listings");
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

          {/* PHOTO UPLOAD SQUARE FIRST */}
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
                overflow-hidden
                transition
              "
            >
              {photo ? (
                <img
                  src={URL.createObjectURL(photo)}
                  alt="Preview"
                  className="w-full h-full object-cover rounded-3xl"
                />
              ) : (
                <>
                  <span className="text-lg">Upload Listing Photo</span>
                  {uploadName && (
                    <p className="mt-2 text-sm text-gray-300">
                      {uploadName}
                    </p>
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
                required
              />
            </label>
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
            <option value="clothing" className="text-black">Clothing</option>
            <option value="Food" className="text-black">Food</option>
            <option value="Beauty" className="text-black">Beauty</option>
            <option value="Training" className="text-black">Training</option>
            <option value="Services" className="text-black">Services</option>
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
            >
              Cancel
            </button>

            <button
              type="submit"
              className="flex-1 py-5 rounded-2xl bg-gradient-to-r from-blue-600 
                         to-indigo-600 text-white text-lg font-semibold 
                         shadow-xl hover:opacity-90 transition"
            >
              Publish Listing
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

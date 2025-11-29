"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function NewListingPage() {
  const { supabase, authUser, role } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    city: "",
  });

  const [photo, setPhoto] = useState(null);

  async function uploadPhoto() {
    if (!photo) return null;

    const fileName = `${authUser.id}-${Date.now()}`;

    const { data, error } = await supabase.storage
      .from("listing-photos")
      .upload(fileName, photo);

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

    const { error } = await supabase.from("listings").insert({
      business_id: authUser.id,
      title: form.title,
      description: form.description,
      price: form.price,
      category: form.category,
      city: form.city,
      photo_url,
    });

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/business/listings");
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Create Listing</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="input"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />

        <textarea
          className="input"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <input
          className="input"
          placeholder="Category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />

        <input
          className="input"
          placeholder="City"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />

        <input
          className="input"
          type="number"
          placeholder="Price"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />

        <input
          type="file"
          onChange={(e) => setPhoto(e.target.files[0])}
        />

        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">
          Create
        </button>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function EditListingPage() {
  const { supabase, authUser } = useAuth();
  const router = useRouter();
  const params = useParams();

  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .single();

    setForm(data);
    setLoading(false);
  }

  async function uploadPhoto() {
    if (!photo) return form.photo_url;

    const fileName = `${authUser.id}-${Date.now()}`;

    const { data, error } = await supabase.storage
      .from("listing-photos")
      .upload(fileName, photo);

    const { data: url } = supabase.storage
      .from("listing-photos")
      .getPublicUrl(fileName);

    return url.publicUrl;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const photo_url = await uploadPhoto();

    await supabase
      .from("listings")
      .update({
        title: form.title,
        description: form.description,
        category: form.category,
        city: form.city,
        price: form.price,
        photo_url,
      })
      .eq("id", id);

    router.push("/business/listings");
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Edit Listing</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="input"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />

        <textarea
          className="input"
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
        />

        <input
          className="input"
          value={form.category}
          onChange={(e) =>
            setForm({ ...form, category: e.target.value })
          }
        />

        <input
          className="input"
          value={form.city}
          onChange={(e) =>
            setForm({ ...form, city: e.target.value })
          }
        />

        <input
          className="input"
          type="number"
          value={form.price}
          onChange={(e) =>
            setForm({ ...form, price: e.target.value })
          }
        />

        <input
          type="file"
          onChange={(e) => setPhoto(e.target.files[0])}
        />

        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">
          Save Changes
        </button>
      </form>
    </div>
  );
}

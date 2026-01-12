"use client";

import { useEffect, useRef, useState } from "react";
import SafeImage from "@/components/SafeImage";
import { uploadPublicImage } from "@/lib/storageUpload";

export default function GalleryManager({
  photos,
  setPhotos,
  tone,
  businessId,
  supabase,
  onToast,
  addTrigger,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!addTrigger) return;
    inputRef.current?.click();
  }, [addTrigger]);

  useEffect(() => {
    return () => {
      photos.forEach((photo) => {
        if (photo?._previewUrl) {
          URL.revokeObjectURL(photo._previewUrl);
        }
      });
    };
  }, [photos]);

  const handleAddPhotos = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    event.target.value = "";
    if (!supabase) {
      onToast?.("error", "Storage is not ready. Please refresh and try again.");
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        const previewUrl = URL.createObjectURL(file);
        const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const optimistic = {
          id: optimisticId,
          photo_url: previewUrl,
          caption: null,
          sort_order: 0,
          created_at: new Date().toISOString(),
          _previewUrl: previewUrl,
        };

        setPhotos((prev) => [optimistic, ...prev]);

        try {
          const { publicUrl } = await uploadPublicImage({
            supabase,
            bucket: "business-gallery",
            file,
            pathPrefix: `${businessId}/gallery`,
            maxSizeMB: 8,
          });

          if (!publicUrl) throw new Error("Upload failed to return a URL.");

          const { data, error } = await supabase
            .from("business_gallery_photos")
            .insert({
              business_id: businessId,
              photo_url: publicUrl,
              caption: null,
              sort_order: 0,
            })
            .select("*")
            .single();

          if (error) throw error;

          setPhotos((prev) =>
            prev.map((item) => (item.id === optimisticId ? data : item))
          );
        } catch (err) {
          setPhotos((prev) => prev.filter((item) => item.id !== optimisticId));
          onToast?.("error", err.message || "Failed to upload photo.");
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId) => {
    if (!confirm("Delete this photo?")) return;
    setDeletingId(photoId);
    const previous = photos;
    setPhotos((prev) => prev.filter((item) => item.id !== photoId));

    const { error } = await supabase
      .from("business_gallery_photos")
      .delete()
      .eq("id", photoId);

    if (error) {
      setPhotos(previous);
      onToast?.("error", error.message || "Failed to delete photo.");
    } else {
      onToast?.("success", "Photo removed.");
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${tone.textStrong}`}>Gallery</h3>
          <p className={`text-sm ${tone.textMuted}`}>Show off your space, products, and team.</p>
        </div>
        <label className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer ${tone.buttonSecondary}`}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleAddPhotos}
            disabled={uploading}
          />
          {uploading ? "Uploading..." : "Add photos"}
        </label>
      </div>

      {!photos.length ? (
        <div className={`rounded-xl border ${tone.cardBorder} ${tone.cardSoft} p-6 text-center`}>
          <p className={`text-sm ${tone.textMuted}`}>No gallery photos yet.</p>
          <p className={`text-xs ${tone.textSoft}`}>Add photos to make your profile pop.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className={`group relative overflow-hidden rounded-xl border ${tone.cardBorder} ${tone.cardSoft}`}
            >
              <SafeImage
                src={photo.photo_url}
                alt={photo.caption || "Business photo"}
                className="h-36 w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                disabled={deletingId === photo.id}
                className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100"
              >
                {deletingId === photo.id ? "Removing" : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

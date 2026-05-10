"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ImagePlus, ListChecks, Megaphone, Pencil, Plus, Settings } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getBusinessPublicUrl } from "@/lib/ids/publicRefs";
import {
  commitTemporaryImages,
  discardTemporaryImages,
  uploadTemporaryImage,
} from "@/lib/images/tempMediaClient";
import { uploadBusinessGalleryPhoto } from "@/lib/images/businessGalleryClient";
import { ProfilePageShell } from "@/components/business/profile-system/ProfileSystem";
import BusinessProfileView from "@/components/publicBusinessProfile/BusinessProfileView";
import OverviewEditor from "@/components/business/profile/OverviewEditor";
import AnnouncementsManager from "@/components/business/profile/AnnouncementsManager";

function filterPayloadByProfile(payload, profile) {
  if (!profile) return {};
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) =>
      Object.prototype.hasOwnProperty.call(profile, key)
    )
  );
}

function publishBusinessAvatarUpdate(payload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("yb:business-avatar-updated", { detail: payload }));
  try {
    const channel = new BroadcastChannel("yb-business-avatar");
    channel.postMessage(payload);
    channel.close();
  } catch {}
}

export default function BusinessProfilePage({
  initialProfile,
  initialGallery,
  initialReviews,
  initialListings,
  initialAnnouncements,
  ratingSummary,
}) {
  const { supabase, user, profile: authProfile, refreshProfile, updateProfile } = useAuth();

  const [profile, setProfile] = useState(initialProfile);
  const [gallery, setGallery] = useState(initialGallery);
  const [reviews] = useState(initialReviews);
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [listings] = useState(initialListings);
  const [editMode, setEditMode] = useState(false);
  const [galleryTrigger, setGalleryTrigger] = useState(0);
  const [announcementTrigger, setAnnouncementTrigger] = useState(0);
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState({ avatar: false, cover: false });
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [deletingGalleryId, setDeletingGalleryId] = useState(null);
  const previewChannelRef = useRef(null);
  const previewSigRef = useRef("");
  const previewSkipRef = useRef(true);
  const galleryInputRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (previewChannelRef.current || typeof BroadcastChannel === "undefined") return;
    previewChannelRef.current = new BroadcastChannel("yb-business-preview");
    return () => previewChannelRef.current?.close();
  }, []);

  const client = supabase ?? getSupabaseBrowserClient();
  const businessId = profile?.id || user?.id || "";

  const emitPreviewUpdate = useCallback(
    (reason = "profile_update") => {
      if (!businessId || typeof window === "undefined") return;
      const payload = { type: "update", businessId, reason, ts: Date.now() };
      try {
        if (!previewChannelRef.current && typeof BroadcastChannel !== "undefined") {
          previewChannelRef.current = new BroadcastChannel("yb-business-preview");
        }
        previewChannelRef.current?.postMessage(payload);
      } catch {}

      try {
        localStorage.setItem("yb_preview_update", JSON.stringify(payload));
      } catch {}
    },
    [businessId]
  );

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!authProfile || !profile || authProfile.id !== profile.id) return;
    if (!profile.profile_photo_url && authProfile.profile_photo_url) {
      setProfile((prev) => ({
        ...prev,
        profile_photo_url: authProfile.profile_photo_url,
      }));
    }
    if (!profile.cover_photo_url && authProfile.cover_photo_url) {
      setProfile((prev) => ({
        ...prev,
        cover_photo_url: authProfile.cover_photo_url,
      }));
    }
  }, [authProfile, profile]);

  useEffect(() => {
    if (!businessId) return;
    if (previewSkipRef.current) {
      previewSkipRef.current = false;
      return;
    }
    const signature = JSON.stringify({
      profile,
      galleryCount: gallery?.length ?? 0,
      announcementCount: announcements?.length ?? 0,
      reviewCount: reviews?.length ?? 0,
    });
    if (signature === previewSigRef.current) return;
    previewSigRef.current = signature;
    const timer = setTimeout(() => emitPreviewUpdate("content_change"), 300);
    return () => clearTimeout(timer);
  }, [businessId, profile, gallery, announcements, reviews, emitPreviewUpdate]);

  const tone = useMemo(
    () => ({
      textBase: "text-slate-900",
      textStrong: "text-slate-900",
      textMuted: "text-slate-600",
      textSoft: "text-slate-400",
      cardSurface: "bg-white",
      cardSoft: "bg-slate-50",
      cardBorder: "border-slate-200",
      headerSurface: "bg-white",
      headerBorder: "border-slate-200/70",
      buttonPrimary: "bg-slate-900 text-white border border-slate-900 hover:bg-slate-800",
      buttonSecondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
      input: "bg-white border-slate-200 text-slate-900 focus:ring-slate-200",
      errorText: "mt-1 text-xs text-rose-600",
      progressTrack: "bg-slate-200",
      progressFill: "bg-[#6a3df0]",
    }),
    []
  );

  const showToast = (type, message) => {
    setToast({ type, message });
  };

  const handlePublicPreview = () => {
    if (!businessId || typeof window === "undefined") return;
      const payload = {
        ts: Date.now(),
        businessId,
        profile,
        gallery,
        announcements,
        listings,
        reviews,
        ratingSummary,
      };
    try {
      sessionStorage.setItem(
        `yb_public_preview_${businessId}`,
        JSON.stringify(payload)
      );
    } catch {}
  };

  const handleHeaderUpload = async (type, file) => {
    if (!file) {
      showToast("error", "No file selected.");
      return;
    }
    if (!businessId) {
      showToast("error", "Business profile not ready. Refresh and try again.");
      return;
    }
    setUploading((prev) => ({ ...prev, [type]: true }));
    let tempAssetId = null;
    let committedAsset = null;

    try {
      const tempUpload = await uploadTemporaryImage({
        file,
        purpose: type === "avatar" ? "business_avatar" : "business_cover",
      });
      tempAssetId = tempUpload?.asset?.id || null;
      const committed = await commitTemporaryImages({
        assetIds: [tempAssetId],
        businessId,
        purpose: type === "avatar" ? "business_avatar" : "business_cover",
      });
      const publicUrl = committed.profileUrl;
      const mediaAsset = committed?.assets?.[0] || null;
      const mediaAssetId = mediaAsset?.id || null;
      committedAsset = mediaAsset;

      if (!publicUrl) throw new Error("Upload failed to return a URL.");

      const userPayload =
        type === "avatar"
          ? { profile_photo_url: publicUrl }
          : { cover_photo_url: publicUrl };
      const businessPayload =
        type === "avatar" && mediaAssetId
          ? {
              profile_photo_url: publicUrl,
              avatar_media_asset_id: mediaAssetId,
            }
          : type === "cover" && mediaAssetId
          ? { cover_photo_url: publicUrl, cover_media_asset_id: mediaAssetId }
          : userPayload;
      const localBusinessPayload =
        type === "avatar" && mediaAsset
          ? { ...businessPayload, business_avatar_media_asset: mediaAsset }
          : businessPayload;
      const filteredUserPayload = filterPayloadByProfile(userPayload, profile);
      const filteredBusinessPayload = filterPayloadByProfile(businessPayload, {
        ...profile,
        avatar_media_asset_id: profile?.avatar_media_asset_id ?? null,
        cover_media_asset_id: profile?.cover_media_asset_id ?? null,
      });
      if (!Object.keys(filteredUserPayload).length) {
        showToast("error", "Photo fields are not available in your profile schema.");
        return;
      }

      setProfile((prev) => ({ ...prev, ...localBusinessPayload }));
      if (!client?.storage) {
        showToast("error", "Storage client is not ready. Please refresh.");
        return;
      }
      const { error } = await client
        .from("users")
        .update(filteredUserPayload)
        .eq("id", businessId);

      if (error) {
        showToast("error", error.message || "Failed to save photo.");
        return;
      }

      let { error: businessPhotoError } = await client
        .from("businesses")
        .update(filteredBusinessPayload)
        .eq("owner_user_id", businessId);

      if (
        businessPhotoError &&
        ((type === "cover" &&
          /cover_media_asset_id|column/i.test(String(businessPhotoError.message || ""))) ||
          (type === "avatar" &&
            /avatar_media_asset_id|column/i.test(String(businessPhotoError.message || ""))))
      ) {
        ({ error: businessPhotoError } = await client
          .from("businesses")
          .update(filteredUserPayload)
          .eq("owner_user_id", businessId));
      }

      if (businessPhotoError) {
        showToast(
          "error",
          businessPhotoError.message || "Photo uploaded, but business sync failed."
        );
        return;
      }

      if (type === "avatar") {
        const avatarUpdatePayload = {
          businessId,
          profile_photo_url: publicUrl,
          avatar_media_asset_id: mediaAssetId,
          business_avatar_media_asset: mediaAsset,
        };
        updateProfile?.({
          ...(authProfile || {}),
          id: businessId,
          profile_photo_url: publicUrl,
          ...(mediaAssetId ? { avatar_media_asset_id: mediaAssetId } : {}),
          ...(mediaAsset ? { business_avatar_media_asset: mediaAsset } : {}),
          updated_at: new Date().toISOString(),
        });
        publishBusinessAvatarUpdate(avatarUpdatePayload);
      }
      refreshProfile?.();
      showToast("success", "Photo uploaded.");
    } catch (err) {
      if (tempAssetId && !committedAsset) {
        await discardTemporaryImages({ assetIds: [tempAssetId] }).catch(() => {});
      }
      showToast("error", err.message || "Failed to upload photo.");
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  useEffect(() => {
    if (!galleryTrigger) return;
    galleryInputRef.current?.click();
  }, [galleryTrigger]);

  const handleGalleryUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || !businessId) return;
    if (!client) {
      showToast("error", "Storage is not ready. Please refresh and try again.");
      return;
    }

    setGalleryUploading(true);
    try {
      for (const file of files) {
        const data = await uploadBusinessGalleryPhoto({
          supabase: client,
          businessId,
          file,
        });
        if (data) {
          setGallery((prev) => [data, ...prev]);
        }
      }
      showToast("success", "Photos uploaded.");
    } catch (err) {
      showToast("error", err.message || "Failed to upload photo.");
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleDeleteGalleryPhoto = async (photoId) => {
    if (!photoId || deletingGalleryId) return;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this photo?");
      if (!confirmed) return;
    }

    const previous = gallery;
    setDeletingGalleryId(photoId);
    setGallery((prev) => prev.filter((item) => item.id !== photoId));

    const { error } = await client
      .from("business_gallery_photos")
      .delete()
      .eq("id", photoId);

    if (error) {
      setGallery(previous);
      showToast("error", error.message || "Failed to delete photo.");
    } else {
      showToast("success", "Photo removed.");
    }

    setDeletingGalleryId(null);
  };

  if (!profile) {
    return <div className="min-h-screen" />;
  }

  return (
    <ProfilePageShell className={`${tone.textBase} !pt-0`}>
      <BusinessProfileView
        mode="owner"
        profile={profile}
        businessId={businessId}
        publicPath={getBusinessPublicUrl(profile || { id: businessId })}
        shell="business"
        ratingSummary={ratingSummary}
        listings={listings}
        listingsPriceMode="base"
        reviews={reviews}
        announcements={announcements}
        gallery={gallery}
        heroVariant="default"
        navClassName="mb-6"
        heroProps={{
          ownerPrimaryAction: {
            label: editMode ? "Close editor" : "Edit profile",
            onClick: () => setEditMode((prev) => !prev),
            icon: Pencil,
          },
          ownerSecondaryActions: [
            {
              label: "Manage listings",
              href: "/business/listings",
              icon: ListChecks,
            },
            {
              label: "Settings",
              href: "/business/settings",
              icon: Settings,
            },
          ],
          editMode,
          uploading,
          onAvatarUpload: (file) => handleHeaderUpload("avatar", file),
          onCoverUpload: (file) => handleHeaderUpload("cover", file),
        }}
        aboutHeaderAction={
          <button
            type="button"
            onClick={() => setEditMode((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
          >
            {editMode ? "Close editor" : "Edit details"}
          </button>
        }
        aboutSupplement={
          editMode ? (
            <OverviewEditor
              profile={profile}
              businessId={businessId}
              tone={tone}
              editMode={editMode}
              setEditMode={setEditMode}
              onProfileUpdate={setProfile}
              onToast={showToast}
            />
          ) : null
        }
        listingsHeaderAction={
          <Link
            href="/business/listings/new"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4 text-[#6a3df0]" />
            Create listing
          </Link>
        }
        listingsItemHrefResolver={(item) => `/business/listings/${item.id}/edit`}
        updatesHeaderAction={
          <button
            type="button"
            onClick={() => setAnnouncementTrigger((prev) => prev + 1)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <Megaphone className="h-4 w-4 text-[#6a3df0]" />
            New update
          </button>
        }
        updatesSupplement={
          <AnnouncementsManager
            announcements={announcements}
            setAnnouncements={setAnnouncements}
            tone={tone}
            businessId={businessId}
            supabase={client}
            onToast={showToast}
            createTrigger={announcementTrigger}
          />
        }
        galleryHeaderAction={
          <button
            type="button"
            onClick={() => setGalleryTrigger((prev) => prev + 1)}
            disabled={galleryUploading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <ImagePlus className="h-4 w-4 text-[#6a3df0]" />
            {galleryUploading ? "Uploading..." : "Add photos"}
          </button>
        }
        galleryTileActions={(photo) => (
          <button
            type="button"
            onClick={() => handleDeleteGalleryPhoto(photo.id)}
            disabled={deletingGalleryId === photo.id}
            className="rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-slate-900 opacity-0 shadow transition group-hover:opacity-100 disabled:opacity-100"
          >
            {deletingGalleryId === photo.id ? "Removing" : "Delete"}
          </button>
        )}
      />

      <label className="hidden">
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleGalleryUpload}
          disabled={galleryUploading}
        />
      </label>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.type === "success"
                ? "bg-emerald-500 text-white"
                : "bg-rose-500 text-white"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </ProfilePageShell>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit3, ImagePlus, Megaphone, ExternalLink } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient";
import { uploadPublicImage } from "@/lib/storageUpload";
import BusinessProfileHeader from "@/components/business/profile/BusinessProfileHeader";
import ProfileTabs from "@/components/business/profile/ProfileTabs";
import OverviewEditor from "@/components/business/profile/OverviewEditor";
import GalleryManager from "@/components/business/profile/GalleryManager";
import ReviewsPanel from "@/components/business/profile/ReviewsPanel";
import ListingsPanel from "@/components/business/profile/ListingsPanel";
import AnnouncementsManager from "@/components/business/profile/AnnouncementsManager";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "gallery", label: "Gallery" },
  { id: "reviews", label: "Reviews" },
  { id: "listings", label: "Listings" },
  { id: "announcements", label: "Announcements" },
];

function filterPayloadByProfile(payload, profile) {
  if (!profile) return {};
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) =>
      Object.prototype.hasOwnProperty.call(profile, key)
    )
  );
}

export default function BusinessProfilePage({
  initialProfile,
  initialGallery,
  initialReviews,
  initialReviewCount,
  initialListings,
  initialAnnouncements,
  ratingSummary,
}) {
  const { supabase, user, profile: authProfile, refreshProfile } = useAuth();
  const { theme, hydrated } = useTheme();
  const isLight = hydrated ? theme === "light" : true;
  const router = useRouter();

  const [profile, setProfile] = useState(initialProfile);
  const [gallery, setGallery] = useState(initialGallery);
  const [reviews, setReviews] = useState(initialReviews);
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [listings] = useState(initialListings);
  const [activeTab, setActiveTab] = useState("overview");
  const [editMode, setEditMode] = useState(false);
  const [galleryTrigger, setGalleryTrigger] = useState(0);
  const [announcementTrigger, setAnnouncementTrigger] = useState(0);
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState({ avatar: false, cover: false });
  const previewChannelRef = useRef(null);
  const previewSigRef = useRef("");
  const previewSkipRef = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (previewChannelRef.current || typeof BroadcastChannel === "undefined") return;
    previewChannelRef.current = new BroadcastChannel("yb-business-preview");
    return () => previewChannelRef.current?.close();
  }, []);

  const client = supabase ?? getBrowserSupabaseClient();
  const businessId = profile?.id || user?.id || "";
  const reviewCount = ratingSummary?.count ?? initialReviewCount ?? 0;
  const averageRating = ratingSummary?.average ?? 0;

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
      textBase: isLight ? "text-slate-900" : "text-white",
      textStrong: isLight ? "text-slate-900" : "text-white",
      textMuted: isLight ? "text-slate-600" : "text-white/70",
      textSoft: isLight ? "text-slate-500" : "text-white/50",
      cardSurface: isLight
        ? "bg-white"
        : "bg-white/10 backdrop-blur-xl",
      cardSoft: isLight ? "bg-slate-50" : "bg-white/5",
      cardBorder: isLight ? "border-slate-200" : "border-white/10",
      headerSurface: isLight
        ? "bg-white/80 backdrop-blur-xl"
        : "bg-white/10 backdrop-blur-xl",
      headerBorder: isLight ? "border-slate-200/70" : "border-white/10",
      buttonPrimary: isLight
        ? "bg-slate-900 text-white border border-slate-900 hover:bg-slate-800"
        : "bg-white/10 text-white border border-white/10 hover:bg-white/20",
      buttonSecondary: isLight
        ? "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
        : "bg-white/5 text-white/80 border border-white/15 hover:bg-white/10",
      tabActive: isLight
        ? "bg-slate-200 text-slate-900"
        : "bg-white text-slate-900",
      tabInactive: isLight
        ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
        : "bg-white/5 text-white/70 hover:bg-white/10",
      input: isLight
        ? "bg-white border-slate-200 text-slate-900 focus:ring-slate-200"
        : "bg-white/5 border-white/10 text-white focus:ring-fuchsia-500/30",
      errorText: isLight
        ? "mt-1 text-xs text-rose-600"
        : "mt-1 text-xs text-rose-300",
      progressTrack: isLight ? "bg-slate-200" : "bg-white/10",
      progressFill: isLight ? "bg-slate-900" : "bg-white/60",
    }),
    [isLight]
  );

  const showToast = (type, message) => {
    setToast({ type, message });
  };

  const publicProfileHref = businessId ? "/business/preview" : null;

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

  useEffect(() => {
    if (!publicProfileHref) return;
    router.prefetch(publicProfileHref);
  }, [publicProfileHref, router]);

  const handleHeaderUpload = async (type, file) => {
    if (!file) {
      showToast("error", "No file selected.");
      return;
    }
    if (!businessId) {
      showToast("error", "Business profile not ready. Refresh and try again.");
      return;
    }
    const bucket = "business-photos";
    setUploading((prev) => ({ ...prev, [type]: true }));

    try {
      const { publicUrl } = await uploadPublicImage({
        supabase: client,
        bucket,
        file,
        pathPrefix: `${businessId}/${type}`,
        maxSizeMB: 8,
      });

      if (!publicUrl) throw new Error("Upload failed to return a URL.");

      const payload =
        type === "avatar"
          ? { profile_photo_url: publicUrl }
          : { cover_photo_url: publicUrl };
      const filteredPayload = filterPayloadByProfile(payload, profile);
      if (!Object.keys(filteredPayload).length) {
        showToast("error", "Photo fields are not available in your profile schema.");
        return;
      }

      setProfile((prev) => ({ ...prev, ...filteredPayload }));
      if (!client?.storage) {
        showToast("error", "Storage client is not ready. Please refresh.");
        return;
      }
      const { error } = await client
        .from("users")
        .update(filteredPayload)
        .eq("id", businessId);

      if (error) {
        showToast("error", error.message || "Failed to save photo.");
        return;
      }
      refreshProfile?.();
      showToast("success", "Photo uploaded.");
    } catch (err) {
      showToast("error", err.message || "Failed to upload photo.");
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const quickActions = [
    {
      label: "Edit profile info",
      description: "Update name, category, and contact",
      icon: Edit3,
      onClick: () => {
        setActiveTab("overview");
        setEditMode(true);
      },
    },
    {
      label: "Add photos",
      description: "Upload fresh gallery images",
      icon: ImagePlus,
      onClick: () => {
        setActiveTab("gallery");
        setGalleryTrigger((prev) => prev + 1);
      },
    },
    {
      label: "Post announcement",
      description: "Share a new update",
      icon: Megaphone,
      onClick: () => {
        setActiveTab("announcements");
        setAnnouncementTrigger((prev) => prev + 1);
      },
    },
    {
      label: "View public profile",
      description: "See your customer view",
      icon: ExternalLink,
      href: publicProfileHref,
    },
  ];

  if (!profile) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className={`min-h-screen pb-20 relative ${tone.textBase} business-theme`}>
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {isLight ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100" />
            <div className="pointer-events-none absolute -top-24 -left-16 h-[320px] w-[320px] rounded-full bg-indigo-200/50 blur-[110px]" />
            <div className="pointer-events-none absolute top-32 -right-24 h-[380px] w-[380px] rounded-full bg-emerald-200/40 blur-[120px]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[#05010d]" />
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 via-fuchsia-900/30 to-black" />
            <div className="pointer-events-none absolute -top-28 -left-20 h-[360px] w-[360px] rounded-full bg-purple-600/30 blur-[120px]" />
            <div className="pointer-events-none absolute top-32 -right-24 h-[420px] w-[420px] rounded-full bg-pink-500/30 blur-[120px]" />
          </>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-0 md:pt-2">
        <div className="-mt-6 md:-mt-8">
          <BusinessProfileHeader
            profile={profile}
            averageRating={averageRating}
            reviewCount={reviewCount}
            tone={tone}
            publicHref={publicProfileHref}
            isLight={isLight}
            editMode={editMode}
            uploading={uploading}
            onAvatarUpload={(file) => handleHeaderUpload("avatar", file)}
            onCoverUpload={(file) => handleHeaderUpload("cover", file)}
            onViewPublic={handlePublicPreview}
          />
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
          <div>
            <ProfileTabs
              tabs={TABS}
              activeTab={activeTab}
              onChange={setActiveTab}
              tone={tone}
            >
              {activeTab === "overview" ? (
                <OverviewEditor
                  profile={profile}
                  tone={tone}
                  editMode={editMode}
                  setEditMode={setEditMode}
                  onProfileUpdate={setProfile}
                  onToast={showToast}
                />
              ) : null}

              {activeTab === "gallery" ? (
                <GalleryManager
                  photos={gallery}
                  setPhotos={setGallery}
                  tone={tone}
                  businessId={businessId}
                  supabase={client}
                  addTrigger={galleryTrigger}
                  onToast={showToast}
                />
              ) : null}

              {activeTab === "reviews" ? (
                <ReviewsPanel
                  reviews={reviews}
                  setReviews={setReviews}
                  reviewCount={reviewCount}
                  ratingSummary={ratingSummary}
                  tone={tone}
                  businessId={businessId}
                  supabase={client}
                />
              ) : null}

              {activeTab === "listings" ? (
                <ListingsPanel listings={listings} tone={tone} />
              ) : null}

              {activeTab === "announcements" ? (
                <AnnouncementsManager
                  announcements={announcements}
                  setAnnouncements={setAnnouncements}
                  tone={tone}
                  businessId={businessId}
                  supabase={client}
                  onToast={showToast}
                  createTrigger={announcementTrigger}
                />
              ) : null}
            </ProfileTabs>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-28 self-start">
            <div className={`rounded-xl border ${tone.cardBorder} ${tone.cardSurface} p-5 md:p-6 space-y-4`}>
              <div>
                <h3 className={`text-base font-semibold ${tone.textStrong}`}>
                  Quick Actions
                </h3>
                <p className={`text-sm ${tone.textMuted}`}>
                  Shortcuts to keep your profile fresh.
                </p>
              </div>

              <div className="space-y-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  if (action.href) {
                    return (
                      <Link
                        key={action.label}
                        href={action.href}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${tone.cardBorder} ${tone.cardSoft}`}
                      >
                        <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold ${tone.textStrong}`}>
                            {action.label}
                          </p>
                          <p className={`text-xs ${tone.textMuted}`}>{action.description}</p>
                        </div>
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.onClick}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition ${tone.cardBorder} ${tone.cardSoft}`}
                    >
                      <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${tone.textStrong}`}>
                          {action.label}
                        </p>
                        <p className={`text-xs ${tone.textMuted}`}>{action.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>

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
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import PublicBusinessHero from "@/components/publicBusinessProfile/PublicBusinessHero";
import PublicBusinessProfileLayoutReset from "@/components/publicBusinessProfile/PublicBusinessProfileLayoutReset";
import BusinessAbout from "@/components/publicBusinessProfile/BusinessAbout";
import BusinessAnnouncementsPreview from "@/components/publicBusinessProfile/BusinessAnnouncementsPreview";
import BusinessGalleryGrid from "@/components/publicBusinessProfile/BusinessGalleryGrid";
import BusinessListingsGrid from "@/components/publicBusinessProfile/BusinessListingsGrid";
import BusinessReviewsPanel from "@/components/publicBusinessProfile/BusinessReviewsPanel";
import ViewerContextEnhancer from "@/components/public/ViewerContextEnhancer";
import { ProfileSectionNav } from "@/components/business/profile-system/ProfileSystem";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  sanitizeAnnouncements,
  sanitizeGalleryPhotos,
} from "@/lib/publicBusinessProfile/normalize";
import {
  BUSINESS_GALLERY_LEGACY_SELECT,
  BUSINESS_GALLERY_WITH_MEDIA_SELECT,
  isBusinessGalleryMediaSelectError,
} from "@/lib/businessGalleryPhotos";

const DEFAULT_NAV_ITEMS = [
  { id: "about", label: "About" },
  { id: "listings", label: "Listings" },
  { id: "reviews", label: "Reviews" },
  { id: "updates", label: "Updates" },
  { id: "gallery", label: "Gallery" },
];

export default function BusinessProfileView({
  mode = "public",
  profile,
  businessId,
  publicPath,
  shell = "public",
  ratingSummary,
  listings,
  reviews,
  announcements,
  gallery,
  loading = false,
  sectionClassName = "rounded-none",
  reviewsClassName = "rounded-none",
  heroProps = {},
  aboutHeaderAction = null,
  aboutSupplement = null,
  listingsHeaderAction = null,
  listingsItemHrefResolver,
  listingsPriceMode = "allIn",
  reviewsProps = {},
  updatesHeaderAction = null,
  updatesRenderItemActions = null,
  updatesSupplement = null,
  galleryHeaderAction = null,
  galleryTileActions = null,
  heroVariant = "default",
  navClassName = "",
  initialContentVisible = false,
  deferSecondaryPublicData = false,
}) {
  const [contentVisible, setContentVisible] = useState(Boolean(initialContentVisible));
  const [deferredAnnouncements, setDeferredAnnouncements] = useState(announcements);
  const [deferredGallery, setDeferredGallery] = useState(gallery);
  const safeListings = Array.isArray(listings) ? listings : [];
  const safeReviews = Array.isArray(reviews) ? reviews : [];
  const safeAnnouncements = Array.isArray(deferredAnnouncements) ? deferredAnnouncements : [];
  const safeGallery = Array.isArray(deferredGallery) ? deferredGallery : [];
  const businessName = profile?.business_name || profile?.full_name || "business";

  useEffect(() => {
    if (initialContentVisible) {
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => setContentVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [businessId, initialContentVisible, profile?.public_id, profile?.id]);

  useEffect(() => {
    if (!deferSecondaryPublicData || !businessId) return undefined;
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client) return undefined;

    async function loadSecondaryData() {
      const nowIso = new Date().toISOString();
      const announcementsQuery = client
        .from("business_announcements")
        .select("id,business_id,title,body,starts_at,ends_at,created_at")
        .eq("business_id", businessId)
        .eq("is_published", true)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .order("created_at", { ascending: false })
        .limit(3);

      let galleryResult = await client
        .from("business_gallery_photos")
        .select(BUSINESS_GALLERY_WITH_MEDIA_SELECT)
        .eq("business_id", businessId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(12);

      if (galleryResult?.error && isBusinessGalleryMediaSelectError(galleryResult.error)) {
        galleryResult = await client
          .from("business_gallery_photos")
          .select(BUSINESS_GALLERY_LEGACY_SELECT)
          .eq("business_id", businessId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(12);
      }

      const announcementsResult = await announcementsQuery;
      if (!active) return;
      setDeferredAnnouncements(sanitizeAnnouncements(announcementsResult?.data));
      setDeferredGallery(sanitizeGalleryPhotos(galleryResult?.data));
    }

    loadSecondaryData().catch(() => {});
    return () => {
      active = false;
    };
  }, [businessId, deferSecondaryPublicData]);

  return (
    <div
      className={[
        "transition-[opacity,transform] duration-200 ease-out",
        loading ? "opacity-75" : contentVisible ? "opacity-100" : "opacity-0",
      ].join(" ")}
      data-testid="public-business-profile-content"
    >
      {heroVariant === "publicFullBleed" ? (
        <PublicBusinessProfileLayoutReset />
      ) : null}
      <PublicBusinessHero
        profile={profile}
        ratingSummary={ratingSummary}
        publicPath={publicPath}
        shell={shell}
        mode={mode}
        variant={heroVariant}
        navItems={heroVariant === "publicFullBleed" ? DEFAULT_NAV_ITEMS : null}
        {...heroProps}
      />

      {heroVariant === "publicFullBleed" ? null : (
        <ProfileSectionNav items={DEFAULT_NAV_ITEMS} className={navClassName} />
      )}

      <div className="space-y-10 md:space-y-12">
        <BusinessAbout
          profile={profile}
          className={sectionClassName}
          headerAction={aboutHeaderAction}
          supplement={aboutSupplement}
        />

        <BusinessListingsGrid
          listings={safeListings}
          className={sectionClassName}
          headerAction={listingsHeaderAction}
          itemHrefResolver={listingsItemHrefResolver}
          priceMode={listingsPriceMode}
        />

        <ViewerContextEnhancer>
          <BusinessReviewsPanel
            businessId={businessId}
            businessName={businessName}
            initialReviews={safeReviews}
            ratingSummary={ratingSummary}
            reviewCount={ratingSummary?.count || safeReviews.length || 0}
            loading={loading}
            className={reviewsClassName}
            mode={mode}
            {...reviewsProps}
          />
        </ViewerContextEnhancer>

        <BusinessAnnouncementsPreview
          announcements={safeAnnouncements}
          className={sectionClassName}
          headerAction={updatesHeaderAction}
          renderItemActions={updatesRenderItemActions}
        />
        {updatesSupplement ? <div>{updatesSupplement}</div> : null}

        <BusinessGalleryGrid
          photos={safeGallery}
          className={sectionClassName}
          headerAction={galleryHeaderAction}
          renderTileActions={galleryTileActions}
        />
      </div>
    </div>
  );
}

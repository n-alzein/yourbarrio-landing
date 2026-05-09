"use client";

import { useState } from "react";
import FastImage from "@/components/FastImage";
import BusinessCoverFallback from "@/components/business/BusinessCoverFallback";
import type { BusinessImageInput } from "@/lib/businessImages";

const EMPTY_IMAGE_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";

type Props = {
  business?: BusinessImageInput;
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
};

export default function BusinessCoverSurface({
  business,
  src,
  alt,
  className = "object-cover",
  sizes,
  priority = false,
  loading = "lazy",
  fetchPriority = "auto",
}: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src && failedSrc !== src);
  const effectiveLoading = priority ? "eager" : loading;
  const effectiveFetchPriority = priority ? "high" : fetchPriority;

  if (!showImage) {
    return (
      <BusinessCoverFallback
        business={business}
        loading={effectiveLoading}
        fetchPriority={effectiveFetchPriority}
        sizes={sizes}
      />
    );
  }

  return (
    <FastImage
      src={src || ""}
      alt={alt}
      fallbackSrc={EMPTY_IMAGE_FALLBACK}
      className={className}
      fill
      sizes={sizes}
      loading={effectiveLoading}
      fetchPriority={effectiveFetchPriority}
      decoding="async"
      onError={() => setFailedSrc(src || null)}
      data-business-cover-source="uploaded"
    />
  );
}

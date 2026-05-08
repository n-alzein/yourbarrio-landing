"use client";

import { useState } from "react";
import FastImage from "@/components/FastImage";
import BusinessIdentityPlaceholder from "@/components/business/BusinessIdentityPlaceholder";
import type { BusinessAvatarImage, BusinessImageInput } from "@/lib/businessImages";
import { getBusinessAvatarImage } from "@/lib/businessImages";

const EMPTY_IMAGE_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";

type Props = {
  business?: BusinessImageInput;
  avatar?: BusinessAvatarImage;
  alt: string;
  className?: string;
  imageClassName?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  compact?: boolean;
  variant?: "avatar" | "cardHero" | "wordmark";
};

export default function BusinessAvatarSurface({
  business,
  avatar,
  alt,
  className = "",
  imageClassName = "object-cover",
  fill = true,
  sizes,
  priority = false,
  compact = false,
  variant = "avatar",
}: Props) {
  const resolvedAvatar = avatar || getBusinessAvatarImage(business || {});
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage =
    resolvedAvatar.kind === "image" && resolvedAvatar.src && failedSrc !== resolvedAvatar.src;

  if (!showImage) {
    return (
      <BusinessIdentityPlaceholder
        business={business}
        avatar={resolvedAvatar}
        compact={compact}
        variant={variant}
        className={className}
      />
    );
  }

  return (
    <FastImage
      src={resolvedAvatar.src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={[className, imageClassName].filter(Boolean).join(" ")}
      fallbackSrc={EMPTY_IMAGE_FALLBACK}
      decoding="async"
      onError={() => setFailedSrc(resolvedAvatar.src)}
    />
  );
}

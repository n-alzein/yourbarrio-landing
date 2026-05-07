"use client";

import { useState } from "react";
import {
  GENERIC_BUSINESS_PLACEHOLDER,
  resolveBusinessImageSrc,
} from "@/lib/placeholders/businessPlaceholders";

export function getBusinessAvatarSrc(profile) {
  return resolveBusinessImageSrc({
    imageUrl: profile?.profile_photo_url || null,
    businessType: profile?.business_type || null,
    legacyCategory: profile?.category || null,
  });
}

export default function BusinessAvatar({
  profile,
  name,
  alt,
  className = "",
  imgClassName = "",
}) {
  const businessKey = profile?.id || profile?.public_id || name || "business";
  const resolvedSrc = getBusinessAvatarSrc(profile);
  const [failedKey, setFailedKey] = useState(null);
  const src =
    failedKey === `${businessKey}:${resolvedSrc}`
      ? GENERIC_BUSINESS_PLACEHOLDER
      : resolvedSrc;

  return (
    <img
      key={`${businessKey}:${src}`}
      src={src}
      alt={alt || name || "Business"}
      className={`${className} ${imgClassName}`.trim()}
      onError={() => {
        setFailedKey(`${businessKey}:${resolvedSrc}`);
      }}
    />
  );
}

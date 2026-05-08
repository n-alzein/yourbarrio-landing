"use client";

import BusinessAvatarSurface from "@/components/business/BusinessAvatarSurface";
import { getBusinessAvatarImage } from "@/lib/businessImages";

export function getBusinessAvatarSrc(profile) {
  const avatar = getBusinessAvatarImage(profile || {});
  return avatar.kind === "image" ? avatar.src : "";
}

export default function BusinessAvatar({
  profile,
  name,
  alt,
  className = "",
  imgClassName = "",
}) {
  const avatar = getBusinessAvatarImage(profile || {});

  return (
    <span className={`relative inline-block overflow-hidden ${className}`.trim()}>
      <BusinessAvatarSurface
        business={profile}
        avatar={avatar}
        alt={alt || name || "Business"}
        className={imgClassName}
        sizes="48px"
        compact
      />
    </span>
  );
}

"use client";

import { ProfileHero } from "@/components/business/profile-system/ProfileSystem";

export default function PublicBusinessHero({
  profile,
  ratingSummary,
  publicPath,
  mode = "public",
  ownerPrimaryAction,
  onAvatarUpload,
  onCoverUpload,
  uploading,
  editMode = false,
  variant = "default",
  ownerSecondaryActions,
  navItems = null,
  showBackLink = false,
}) {
  const backHref = showBackLink ? "/business/profile" : null;

  return (
    <ProfileHero
      profile={profile}
      ratingSummary={ratingSummary}
      publicPath={publicPath}
      backHref={backHref}
      mode="preview"
      viewerMode={mode}
      ownerPrimaryAction={ownerPrimaryAction}
      ownerSecondaryActions={ownerSecondaryActions}
      onAvatarUpload={onAvatarUpload}
      onCoverUpload={onCoverUpload}
      uploading={uploading}
      editMode={editMode}
      variant={variant}
      navItems={navItems}
    />
  );
}

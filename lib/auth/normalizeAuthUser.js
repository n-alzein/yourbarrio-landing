import { resolveAvatarUrl } from "@/lib/avatarUrl";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeAuthUser(user) {
  if (!user || typeof user !== "object" || !user.id) return null;

  const userMetadata = asRecord(user.user_metadata);
  const appMetadata = asRecord(user.app_metadata);
  const authAvatarUrl = resolveAvatarUrl(
    user.avatar_url,
    user.picture,
    user.profile_photo_url,
    user.photo_url,
    user.image_url,
    userMetadata
  );
  const normalizedMetadata = {
    ...userMetadata,
  };

  if (authAvatarUrl && !resolveAvatarUrl(normalizedMetadata)) {
    normalizedMetadata.avatar_url = authAvatarUrl;
  }

  return {
    ...user,
    email: user.email || normalizedMetadata.email || null,
    app_metadata: appMetadata,
    user_metadata: normalizedMetadata,
    avatar_url: resolveAvatarUrl(user.avatar_url, normalizedMetadata.avatar_url) || null,
    picture: resolveAvatarUrl(user.picture, normalizedMetadata.picture) || null,
  };
}

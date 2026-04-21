const INVALID_AVATAR_VALUES = new Set(["", "null", "undefined"]);

const PLACEHOLDER_AVATAR_PATHS = new Set([
  "/business-placeholder.png",
  "/customer-placeholder.png",
]);

const METADATA_AVATAR_KEYS = [
  "avatar_url",
  "picture",
  "profile_photo_url",
  "photo_url",
  "photoURL",
  "image_url",
  "image",
];

const METADATA_CONTAINER_KEYS = [
  "user_metadata",
  "auth_metadata",
  "metadata",
  "raw_user_meta_data",
];

function normalizeAvatarCandidate(value) {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

function collectAvatarCandidates(value, output, seen = new WeakSet()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectAvatarCandidates(item, output, seen));
    return;
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) return;
    seen.add(value);
    METADATA_AVATAR_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        collectAvatarCandidates(value[key], output, seen);
      }
    });
    METADATA_CONTAINER_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        collectAvatarCandidates(value[key], output, seen);
      }
    });
    return;
  }

  output.push(value);
}

export function getValidAvatarUrls(...candidates) {
  const flattenedCandidates = [];
  collectAvatarCandidates(candidates, flattenedCandidates);
  const urls = [];
  const seen = new Set();

  for (const candidate of flattenedCandidates) {
    const value = normalizeAvatarCandidate(candidate);
    const normalized = value.toLowerCase();

    if (INVALID_AVATAR_VALUES.has(normalized)) continue;
    if (PLACEHOLDER_AVATAR_PATHS.has(value)) continue;
    if (seen.has(value)) continue;

    urls.push(value);
    seen.add(value);
  }

  return urls;
}

export function getValidAvatarUrl(...candidates) {
  return getValidAvatarUrls(...candidates)[0] || null;
}

export function resolveAvatarUrl(...candidates) {
  return getValidAvatarUrl(...candidates);
}

export function mergeAvatarState(prev, next) {
  const nextUrl = getValidAvatarUrl(next);
  if (nextUrl) return nextUrl;
  return getValidAvatarUrl(prev);
}

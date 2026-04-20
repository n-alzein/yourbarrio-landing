function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function firstAlpha(value) {
  const match = normalizeText(value).match(/[A-Za-z]/);
  return match ? match[0].toUpperCase() : "";
}

function initialsFromName(value) {
  const normalized = normalizeText(value);
  if (!normalized || normalized.toLowerCase() === "unknown") return "";

  const words = normalized
    .split(" ")
    .map((word) => firstAlpha(word))
    .filter(Boolean);

  if (words.length === 0) return "";
  if (words.length === 1) return words[0];
  return `${words[0]}${words[words.length - 1]}`.slice(0, 2).toUpperCase();
}

function initialFromEmail(value) {
  const localPart = normalizeText(value).split("@")[0] || "";
  return firstAlpha(localPart);
}

export function getAvatarInitials(input = {}) {
  if (typeof input === "string") {
    return initialsFromName(input);
  }

  const fullName = initialsFromName(input?.fullName);
  if (fullName) return fullName;

  const displayName = initialsFromName(input?.displayName || input?.name);
  if (displayName) return displayName;

  const businessName = initialsFromName(input?.businessName);
  if (businessName) return businessName;

  const email = initialFromEmail(input?.email);
  if (email) return email;

  return "";
}

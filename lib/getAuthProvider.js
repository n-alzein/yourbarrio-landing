export function getPrimaryAuthProvider(sessionUser) {
  const provider = sessionUser?.app_metadata?.provider;
  const providers = sessionUser?.app_metadata?.providers;

  if (provider) return provider;
  if (Array.isArray(providers) && providers.length > 0) return providers[0];

  return "email";
}

export function getAuthProviderLabel(sessionUser) {
  const provider = (getPrimaryAuthProvider(sessionUser) || "").toLowerCase();

  if (provider === "email") return "Email & password";
  if (provider === "google") return "Google OAuth";

  return provider ? `${provider} OAuth` : "Email & password";
}

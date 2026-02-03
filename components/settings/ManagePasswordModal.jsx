"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MIN_PASSWORD_LENGTH = 8;

function getAuthProviderInfo(authUser) {
  const provider = authUser?.app_metadata?.provider || null;
  const providers = authUser?.app_metadata?.providers || null;
  const normalizedProviders = Array.isArray(providers)
    ? providers
    : providers
      ? [providers]
      : [];
  return { provider, providers: normalizedProviders };
}

export default function ManagePasswordModal({
  open,
  onClose,
  supabase,
  user,
  onSuccess,
}) {
  const [authUser, setAuthUser] = useState(user ?? null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState({
    current: false,
    password: false,
    confirm: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const didInitRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setErrorMessage("");
    setInfoMessage("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTouched({ current: false, password: false, confirm: false });
    setSubmitAttempted(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!supabase) return;
    let active = true;
    setLoadingUser(true);
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setAuthUser(user ?? null);
          setErrorMessage(error.message || "Unable to load user details.");
          return;
        }
        setAuthUser(data?.user ?? user ?? null);
      })
      .catch(() => {
        if (!active) return;
        setAuthUser(user ?? null);
      })
      .finally(() => {
        if (!active) return;
        setLoadingUser(false);
      });
    return () => {
      active = false;
    };
  }, [open, supabase, user]);

  useEffect(() => {
    if (!open) return;
    if (didInitRef.current) return;
    didInitRef.current = true;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      didInitRef.current = false;
    };
  }, [onClose, open]);

  const { provider, providers } = useMemo(
    () => getAuthProviderInfo(authUser),
    [authUser]
  );
  const canUpdatePassword = useMemo(() => {
    if (provider === "email") return true;
    if (providers.includes("email")) return true;
    return false;
  }, [provider, providers]);

  const userEmail = authUser?.email || user?.email || "";

  const passwordTooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const passwordsMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const currentPasswordMissing = currentPassword.length === 0;

  const showCurrentError =
    (touched.current || submitAttempted) && currentPasswordMissing;
  const showPasswordError =
    (touched.password || submitAttempted) && passwordTooShort;
  const showConfirmError =
    (touched.confirm || submitAttempted) &&
    (confirmPassword.length === 0 || passwordsMismatch);

  const formValid =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    confirmPassword.length >= MIN_PASSWORD_LENGTH &&
    newPassword === confirmPassword;

  const handleClose = () => {
    setErrorMessage("");
    setInfoMessage("");
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setErrorMessage("");
    setInfoMessage("");

    if (!formValid || !supabase) return;
    if (!userEmail) {
      setErrorMessage("We couldn't verify your account email.");
      return;
    }

    setSaving(true);
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });

    if (verifyError) {
      setSaving(false);
      setErrorMessage(verifyError.message || "Current password is incorrect.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSaving(false);

    if (error) {
      setErrorMessage(error.message || "Failed to update password.");
      return;
    }

    if (onSuccess) {
      onSuccess("Password updated.");
    }
    handleClose();
  };

  const handleSendReset = async () => {
    if (!supabase || !userEmail) return;
    setSendingReset(true);
    setErrorMessage("");
    setInfoMessage("");
    try {
      const redirectTo = `${window.location.origin}/auth/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo,
      });
      if (error) {
        setErrorMessage(error.message || "Failed to send reset email.");
      } else {
        setInfoMessage("Password reset email sent.");
      }
    } catch (err) {
      setErrorMessage(err?.message || "Failed to send reset email.");
    } finally {
      setSendingReset(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Manage password"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-black p-6 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">Manage password</h2>
            <p className="mt-1 text-sm text-white/60">
              Update how you sign in to YourBarrio.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white/70 hover:text-white"
          >
            Close
          </button>
        </div>

        {loadingUser ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-white/70">
            <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
            Loading security details...
          </div>
        ) : null}

        {!loadingUser && !canUpdatePassword ? (
          <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-white/80">
              You signed in with Google. Manage your password through your
              Google account or set a password via email reset.
            </p>
            <button
              type="button"
              onClick={handleSendReset}
              disabled={!userEmail || sendingReset}
              className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
                userEmail && !sendingReset
                  ? "bg-white text-black hover:bg-gray-200"
                  : "cursor-not-allowed bg-white/20 text-white/40"
              }`}
            >
              {sendingReset ? "Sending..." : "Send password reset email"}
            </button>
          </div>
        ) : null}

        {!loadingUser && canUpdatePassword ? (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="current-password"
                className="block text-sm text-white/70 mb-1.5"
              >
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, current: true }))
                }
                className={`h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-base md:text-sm text-white placeholder:text-white/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 focus-visible:border-pink-400/60 ${
                  showCurrentError
                    ? "border-rose-400 focus-visible:ring-rose-400/60"
                    : ""
                }`}
                placeholder="Enter your current password"
                autoComplete="current-password"
              />
              <p
                className={`mt-1.5 text-xs min-h-[1.25rem] ${
                  showCurrentError ? "text-rose-300" : "text-white/45"
                }`}
              >
                {showCurrentError
                  ? "Enter your current password."
                  : "Required to verify your update."}
              </p>
            </div>
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm text-white/70 mb-1.5"
              >
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, password: true }))
                }
                className={`h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-base md:text-sm text-white placeholder:text-white/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 focus-visible:border-pink-400/60 ${
                  showPasswordError
                    ? "border-rose-400 focus-visible:ring-rose-400/60"
                    : ""
                }`}
                placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
                autoComplete="new-password"
              />
              <p className="mt-1.5 text-xs min-h-[1.25rem] text-white/45">
                {showPasswordError
                  ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
                  : "Use at least 8 characters."}
              </p>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm text-white/70 mb-1.5"
              >
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, confirm: true }))
                }
                className={`h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-base md:text-sm text-white placeholder:text-white/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 focus-visible:border-pink-400/60 ${
                  showConfirmError
                    ? "border-rose-400 focus-visible:ring-rose-400/60"
                    : ""
                }`}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
              />
              <p
                className={`mt-1.5 text-xs min-h-[1.25rem] ${
                  showConfirmError ? "text-rose-300" : "text-white/45"
                }`}
              >
                {showConfirmError
                  ? "Passwords must match."
                  : "Make sure both entries match."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={!formValid || saving}
                className={`inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition ${
                  formValid && !saving
                    ? "bg-white text-black hover:bg-gray-200"
                    : "cursor-not-allowed bg-white/20 text-white/40"
                }`}
              >
                {saving ? "Updating..." : "Update password"}
              </button>
              <button
                type="button"
                onClick={handleSendReset}
                disabled={!userEmail || sendingReset}
                className="text-sm font-semibold text-pink-300 hover:text-pink-200"
              >
                {sendingReset ? "Sending reset..." : "Send password reset email"}
              </button>
            </div>
          </form>
        ) : null}

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        {infoMessage ? (
          <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {infoMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}

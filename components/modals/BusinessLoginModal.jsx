"use client";

import BusinessLoginClient from "@/components/business-auth/BusinessLoginClient";
import AuthDialogShell from "@/components/auth/AuthDialogShell";
import { clearAuthIntent } from "@/lib/auth/authIntent";

export default function BusinessLoginModal({ onClose }) {
  const handleClose = () => {
    clearAuthIntent();
    onClose?.();
  };

  return (
    <AuthDialogShell onClose={handleClose} label="Business login">
      <BusinessLoginClient isPopup={false} callbackError="" />
    </AuthDialogShell>
  );
}

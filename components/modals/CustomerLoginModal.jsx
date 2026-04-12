"use client";

import BaseModal from "./BaseModal";
import { useModal } from "./ModalProvider";
import CustomerLoginForm from "@/components/auth/CustomerLoginForm";
import { clearAuthIntent } from "@/lib/auth/authIntent";

export default function CustomerLoginModal({ onClose, next: nextFromModalProps = null }) {
  const { openModal } = useModal();
  if (process.env.NODE_ENV !== "production") {
    console.info("[auth-next] modal received next:", nextFromModalProps || "/");
  }
  const handleClose = () => {
    clearAuthIntent();
    onClose?.();
  };

  return (
    <BaseModal
      title="Welcome back"
      description="Sign in to your customer account to continue exploring nearby businesses."
      onClose={handleClose}
    >
      <CustomerLoginForm
        next={nextFromModalProps}
        onSuccess={() => handleClose()}
        onSwitchToSignup={() => openModal("customer-signup")}
      />
    </BaseModal>
  );
}

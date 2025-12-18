"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  Suspense,
  useState,
} from "react";
import { createPortal } from "react-dom";
import CustomerLoginModal from "./CustomerLoginModal";
import CustomerSignupModal from "./CustomerSignupModal";

const ModalContext = createContext(null);

const MODAL_COMPONENTS = {
  "customer-login": CustomerLoginModal,
  "customer-signup": CustomerSignupModal,
};

export function ModalProvider({ children }) {
  const [modal, setModal] = useState({ type: null, props: {} });
  const [mounted, setMounted] = useState(false);

  const closeModal = useCallback(() => {
    setModal({ type: null, props: {} });
  }, []);

  const openModal = useCallback((type, props = {}) => {
    if (!MODAL_COMPONENTS[type]) return;
    setModal({ type, props });
  }, []);

  // Client-only portal target
  useEffect(() => {
    setMounted(true);
  }, []);

  // Open modal from URL query (?modal=customer-login)
  useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const modalParam = params.get("modal");

    if (modalParam && MODAL_COMPONENTS[modalParam]) {
      openModal(modalParam);

      // Clean up modal param but preserve others
      params.delete("modal");
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, [mounted, openModal]);

  // ESC to close
  useEffect(() => {
    if (!modal.type) return undefined;
    const handler = (event) => {
      if (event.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [modal.type, closeModal]);

  // Lock background scroll
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (modal.type) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
    return undefined;
  }, [modal.type]);

  const value = useMemo(
    () => ({
      openModal,
      closeModal,
      activeModal: modal.type,
    }),
    [openModal, closeModal, modal.type]
  );

  const ModalComponent = modal.type ? MODAL_COMPONENTS[modal.type] : null;

  return (
    <ModalContext.Provider value={value}>
      {children}
      {mounted && ModalComponent
        ? createPortal(
            <Suspense fallback={null}>
              <ModalComponent {...modal.props} onClose={closeModal} />
            </Suspense>,
            document.body
          )
        : null}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}

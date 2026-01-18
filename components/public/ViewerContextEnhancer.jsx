"use client";

import { createContext, useContext, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";

const ViewerContext = createContext({
  status: "guest",
  role: null,
  user: null,
  profile: null,
  loading: true,
  isAuthenticated: false,
  isCustomer: false,
  isBusiness: false,
  isAdmin: false,
  isInternal: false,
});

function resolveStatus(role, hasUser) {
  if (!hasUser) return "guest";
  if (!role) return "customer";
  if (role === "business") return "business";
  if (role === "admin") return "admin";
  if (role === "internal") return "internal";
  return "customer";
}

export default function ViewerContextEnhancer({ children }) {
  const { user, profile, role, status } = useAuth();

  const value = useMemo(() => {
    const isAuthenticated = Boolean(user?.id);
    const resolvedRole = role ?? null;
    const computedStatus = resolveStatus(resolvedRole, isAuthenticated);
    const isBusiness = computedStatus === "business";
    const isAdmin = computedStatus === "admin";
    const isInternal = computedStatus === "internal";
    const isCustomer = computedStatus === "customer" || isAdmin || isInternal;

    return {
      status: computedStatus,
      role: resolvedRole,
      user,
      profile,
      loading: status === "loading",
      isAuthenticated,
      isCustomer,
      isBusiness,
      isAdmin,
      isInternal,
    };
  }, [profile, role, status, user]);

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewerContext() {
  return useContext(ViewerContext);
}

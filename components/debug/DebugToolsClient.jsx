"use client";

import React from "react";
import NavTrace from "@/components/debug/NavTrace";
import ClickDiagnostics from "@/components/debug/ClickDiagnostics";

export default function DebugToolsClient() {
  const clickDiag = process.env.NEXT_PUBLIC_CLICK_DIAG === "1";
  const navTrace =
    process.env.NEXT_PUBLIC_NAV_TRACE === "1" || process.env.NEXT_PUBLIC_CLICK_DIAG === "1";
  const enabled = clickDiag || navTrace;

  if (!enabled) return null;

  return (
    <>
      {navTrace ? <NavTrace /> : null}
      {clickDiag ? <ClickDiagnostics /> : null}
    </>
  );
}

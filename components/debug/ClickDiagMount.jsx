"use client";

import ClickDiagnostics from "./ClickDiagnostics";

const CLICK_DIAG_ENABLED = process.env.NEXT_PUBLIC_CLICK_DIAG === "1";

export default function ClickDiagMount() {
  if (!CLICK_DIAG_ENABLED) return null;
  return <ClickDiagnostics />;
}

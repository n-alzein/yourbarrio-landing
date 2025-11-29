"use client";

import { useEffect } from "react";
import RegisterPage from "@/app/register/page";

export default function BusinessRegisterForward() {
  useEffect(() => {
    // force business navbar mode
    sessionStorage.setItem("businessNavMode", "1");
  }, []);

  // Reuse the existing Register Page UI
  return <RegisterPage isBusiness />;
}

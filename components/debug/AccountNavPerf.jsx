"use client";

import { useEffect } from "react";
import { installAccountNavPerf } from "@/lib/accountNavPerf";

export default function AccountNavPerf() {
  useEffect(() => {
    installAccountNavPerf();
  }, []);

  return null;
}

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function BusinessPreviewToolbar({ className = "" }) {
  const { role } = useAuth();
  if (role !== "business") return null;

  return (
    <div className={`w-full px-4 sm:px-6 md:px-10 pointer-events-auto ${className}`}>
      <Link
        href="/business/profile"
        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/20 transition theme-lock"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to business profile
      </Link>
    </div>
  );
}

"use client";

import Image from "next/image";
import { cx } from "@/lib/utils/cx";
import type { BusinessImageInput } from "@/lib/businessImages";

export const DEFAULT_BUSINESS_COVER_FALLBACK_SRC =
  "/images/fallback/business-profile-cover-neighborhood.png";

type Props = {
  business?: BusinessImageInput;
  className?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  sizes?: string;
};

export default function BusinessCoverFallback({
  className = "",
  loading = "lazy",
  fetchPriority = "auto",
  sizes = "100vw",
}: Props) {
  return (
    <div
      className={cx("relative h-full w-full overflow-hidden bg-[#f6efe8]", className)}
      data-business-cover-fallback="true"
      data-business-cover-source="defaultFallback"
    >
      <Image
        src={DEFAULT_BUSINESS_COVER_FALLBACK_SRC}
        alt=""
        aria-hidden="true"
        fill
        sizes={sizes}
        loading={loading}
        fetchPriority={fetchPriority}
        className="object-cover object-[62%_center]"
        decoding="async"
      />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { markImageFailed, resolveImageSrc } from "@/lib/safeImage";

export default function SafeImage({
  src,
  alt = "",
  fallbackSrc = "/business-placeholder.png",
  onError,
  onLoad,
  ...rest
}) {
  const resolvedFallback = useMemo(
    () => fallbackSrc || "/business-placeholder.png",
    [fallbackSrc]
  );
  const [currentSrc, setCurrentSrc] = useState(() =>
    resolveImageSrc(src, resolvedFallback)
  );

  useEffect(() => {
    setCurrentSrc(resolveImageSrc(src, resolvedFallback));
  }, [src, resolvedFallback]);

  const handleError = (event) => {
    if (currentSrc === resolvedFallback) {
      return;
    }
    markImageFailed(currentSrc);
    if (typeof onError === "function") {
      onError(event);
    }
    setCurrentSrc(resolvedFallback);
  };

  const handleLoad = (event) => {
    if (typeof onLoad === "function") {
      onLoad(event);
    }
  };

  const isPlaceholder = currentSrc === resolvedFallback;

  return (
    <img
      {...rest}
      src={currentSrc}
      alt={alt}
      data-placeholder={isPlaceholder ? "true" : undefined}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
}

"use client";

import Image, { ImageProps } from "next/image";
import { useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { appendCrashLog } from "@/lib/crashlog";
import { buildImageUrl } from "@/lib/imageUrl";
import { markImageFailed, resolveImageSrc } from "@/lib/safeImage";

const DATA_URI_RE = /^(data:|blob:)/i;
const DEFAULT_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMxMTIxMzAiIG9wYWNpdHk9IjAuMjUiIC8+PC9zdmc+";

type PlaceholderMode = "blur" | "empty" | "skeleton";

type FastImageProps = Omit<
  ImageProps,
  "src" | "alt" | "loading" | "placeholder" | "blurDataURL"
> & {
  src: string;
  alt: string;
  fallbackSrc?: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  placeholder?: PlaceholderMode;
  blurDataURL?: string;
  logErrors?: boolean;
  cdnParams?: {
    width?: number;
    quality?: number;
    format?: "avif" | "webp" | "jpeg" | "png";
    version?: string | number;
  };
};

export default function FastImage({
  src,
  alt,
  fallbackSrc = "/business-placeholder.png",
  priority = false,
  loading,
  fetchPriority,
  decoding = "async",
  referrerPolicy = "strict-origin-when-cross-origin",
  placeholder = "skeleton",
  blurDataURL,
  logErrors = true,
  cdnParams,
  onError,
  onLoad,
  onLoadingComplete,
  sizes,
  fill,
  ...rest
}: FastImageProps) {
  const resolvedFallback = useMemo(
    () => fallbackSrc || "/business-placeholder.png",
    [fallbackSrc]
  );
  const resolvedSrc = useMemo(
    () => resolveImageSrc(src, resolvedFallback),
    [src, resolvedFallback]
  );

  return (
    <FastImageInner
      {...rest}
      key={resolvedSrc}
      src={resolvedSrc}
      alt={alt}
      fallbackSrc={resolvedFallback}
      priority={priority}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding={decoding}
      referrerPolicy={referrerPolicy}
      placeholder={placeholder}
      blurDataURL={blurDataURL}
      logErrors={logErrors}
      cdnParams={cdnParams}
      onError={onError}
      onLoad={onLoad}
      onLoadingComplete={onLoadingComplete}
      sizes={sizes}
      fill={fill}
    />
  );
}

function FastImageInner({
  src,
  alt,
  fallbackSrc,
  priority,
  loading,
  fetchPriority,
  decoding,
  referrerPolicy,
  placeholder,
  blurDataURL,
  logErrors,
  cdnParams,
  onError,
  onLoad,
  onLoadingComplete,
  sizes,
  fill,
  ...rest
}: FastImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isLoaded, setIsLoaded] = useState(false);

  const finalSrc = useMemo(() => {
    if (!cdnParams) return currentSrc;
    return buildImageUrl(currentSrc, cdnParams);
  }, [cdnParams, currentSrc]);

  const wantsBlur = placeholder === "blur" || placeholder === "skeleton";
  const effectivePlaceholder = wantsBlur ? "blur" : "empty";
  const effectiveBlurDataURL = wantsBlur
    ? blurDataURL || DEFAULT_BLUR_DATA_URL
    : undefined;
  const effectiveLoading = priority ? "eager" : loading || "lazy";
  const effectiveFetchPriority = priority ? "high" : fetchPriority || "auto";
  const unoptimized = DATA_URI_RE.test(finalSrc);
  const effectiveSizes = sizes || (fill ? "100vw" : undefined);

  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (currentSrc === fallbackSrc) return;
    markImageFailed(currentSrc);
    if (logErrors) {
      appendCrashLog({
        type: "image-error",
        message: "Image failed to load",
        src: currentSrc,
        fallback: fallbackSrc,
      });
    }
    if (typeof onError === "function") {
      onError(event);
    }
    setCurrentSrc(fallbackSrc);
  };

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true);
    if (typeof onLoad === "function") {
      onLoad(event);
    }
    if (typeof onLoadingComplete === "function") {
      onLoadingComplete(event.currentTarget);
    }
  };

  return (
    <Image
      {...rest}
      src={finalSrc}
      alt={alt}
      fill={fill}
      sizes={effectiveSizes}
      loading={effectiveLoading}
      fetchPriority={effectiveFetchPriority}
      decoding={decoding}
      referrerPolicy={referrerPolicy}
      placeholder={effectivePlaceholder}
      blurDataURL={effectiveBlurDataURL}
      data-loaded={isLoaded ? "true" : "false"}
      data-placeholder={currentSrc === fallbackSrc ? "true" : undefined}
      onError={handleError}
      onLoad={handleLoad}
      unoptimized={unoptimized}
      className={
        placeholder === "skeleton"
          ? [rest.className, "fast-image-skeleton"].filter(Boolean).join(" ")
          : rest.className
      }
    />
  );
}

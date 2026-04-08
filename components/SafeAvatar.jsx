"use client";

import { useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import { markImageFailed, resolveImageSrc } from "@/lib/safeImage";

function getInitials(name = "") {
  const normalized = String(name || "")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized || normalized.toLowerCase() === "unknown") {
    return "";
  }

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length === 0) return "";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

export default function SafeAvatar({
  src,
  name = "",
  fallbackSrc = "/business-placeholder.png",
  alt,
  className = "",
  initialsClassName = "",
  iconClassName = "",
}) {
  const resolvedFallback = useMemo(
    () => fallbackSrc || "/business-placeholder.png",
    [fallbackSrc]
  );
  const resolvedSrc = useMemo(
    () => resolveImageSrc(src, resolvedFallback),
    [resolvedFallback, src]
  );
  const initialFallback = !src || resolvedSrc === resolvedFallback;
  const key = `${resolvedSrc}:${name}:${initialFallback ? "fallback" : "image"}`;

  return (
    <SafeAvatarInner
      key={key}
      src={resolvedSrc}
      name={name}
      alt={alt}
      className={className}
      initialsClassName={initialsClassName}
      iconClassName={iconClassName}
      showFallbackInitially={initialFallback}
    />
  );
}

function SafeAvatarInner({
  src,
  name,
  alt,
  className,
  initialsClassName,
  iconClassName,
  showFallbackInitially,
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [showFallback, setShowFallback] = useState(showFallbackInitially);

  const initials = useMemo(() => getInitials(name), [name]);

  if (showFallback) {
    return (
      <div
        aria-label={alt || name || "Avatar"}
        className={[
          "flex items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.2),_rgba(255,255,255,0.08)_45%,_rgba(15,23,42,0.65)_100%)] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {initials ? (
          <span
            aria-hidden="true"
            className={[
              "select-none text-sm font-semibold uppercase tracking-[0.08em]",
              initialsClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {initials}
          </span>
        ) : (
          <UserRound
            aria-hidden="true"
            className={["h-5 w-5 text-white/70", iconClassName].filter(Boolean).join(" ")}
          />
        )}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt || name || "Avatar"}
      className={className}
      onError={() => {
        markImageFailed(currentSrc);
        setShowFallback(true);
      }}
    />
  );
}

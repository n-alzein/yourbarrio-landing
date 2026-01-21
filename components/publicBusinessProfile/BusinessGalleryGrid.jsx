"use client";

import { useEffect, useMemo, useState } from "react";
import FastImage from "@/components/FastImage";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export default function BusinessGalleryGrid({ photos, className = "" }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const activePhoto = useMemo(() => {
    if (activeIndex === null) return null;
    return photos?.[activeIndex] || null;
  }, [activeIndex, photos]);

  useEffect(() => {
    if (activeIndex === null) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setActiveIndex(null);
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((prev) => {
          if (prev === null) return prev;
          return Math.min(prev + 1, photos.length - 1);
        });
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((prev) => {
          if (prev === null) return prev;
          return Math.max(prev - 1, 0);
        });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, photos?.length]);

  return (
    <section
      className={`rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.7)] ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold">Gallery</h2>
          <p className="text-sm text-white/70">
            A peek at their latest work.
          </p>
        </div>
      </div>

      {!photos?.length ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
          No gallery photos yet.
        </div>
      ) : (
        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {photos.map((photo, index) => (
            <button
              key={photo.id || index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="group relative h-44 w-64 flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg"
            >
              <FastImage
                src={photo.photo_url || "/business-placeholder.png"}
                alt={photo.caption || "Gallery photo"}
                className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                fill
                sizes="256px"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
            </button>
          ))}
        </div>
      )}

      {activePhoto ? (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 theme-lock"
          onClick={() => setActiveIndex(null)}
          role="presentation"
        >
          <div
            className="relative max-w-4xl w-full"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              className="absolute -top-12 right-0 rounded-full border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="relative h-[60vh] overflow-hidden rounded-3xl border border-white/10 bg-black">
              <FastImage
                src={activePhoto.photo_url || "/business-placeholder.png"}
                alt={activePhoto.caption || "Gallery photo"}
                className="object-contain bg-black"
                fill
                sizes="100vw"
                priority
                decoding="async"
              />
            </div>
            {activePhoto.caption ? (
              <p className="mt-3 text-center text-sm text-white/80">
                {activePhoto.caption}
              </p>
            ) : null}

            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((prev) =>
                      prev === null ? prev : Math.max(prev - 1, 0)
                    )
                  }
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20 transition"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((prev) =>
                      prev === null
                        ? prev
                        : Math.min(prev + 1, photos.length - 1)
                    )
                  }
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20 transition"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useId, useMemo, useState } from "react";
import { ImagePlus, Sparkles, Trash2 } from "lucide-react";
import {
  ENHANCEABLE_BACKGROUND_OPTIONS,
  getDraftDisplayUrl,
} from "@/lib/listingPhotoDrafts";

function PhotoSurface({ src, alt, className = "" }) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400 ${className}`}
      >
        No preview
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`h-full w-full rounded-2xl object-contain ${className}`}
    />
  );
}

export default function ListingPhotoManager({
  photos,
  maxPhotos,
  helperText,
  error,
  onAddFiles,
  onRemovePhoto,
  onEnhancePhoto,
  onChooseVariant,
  onBackgroundChange,
  canAddMore,
}) {
  const inputId = useId();
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);

  const selectedPhoto = useMemo(() => {
    if (!photos?.length) return null;
    return photos.find((photo) => photo.id === selectedPhotoId) || photos[0];
  }, [photos, selectedPhotoId]);
  const isUnsavedSelectedPhoto =
    selectedPhoto?.status === "new" && Boolean(selectedPhoto?.original?.file);
  const hasUnsavedEnhancedPhoto =
    isUnsavedSelectedPhoto && Boolean(selectedPhoto?.enhanced?.publicUrl);
  const canConfigureEnhancement = isUnsavedSelectedPhoto && !hasUnsavedEnhancedPhoto;

  const handleFileChange = (event) => {
    const files = event.target.files;
    if (files?.length) {
      onAddFiles?.(files, {
        captureAttributePresent: event.target.hasAttribute("capture"),
        inputControl: "listing-photo-primary",
      });
    }
    event.target.value = "";
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Photos</h2>
          {helperText ? <p className="text-sm leading-6 text-slate-600">{helperText}</p> : null}
        </div>

        {canAddMore ? (
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-400 hover:text-slate-900"
          >
            <ImagePlus className="h-4 w-4" />
            Upload photos
          </label>
        ) : (
          <div className="text-sm text-slate-500">
            {photos.length} / {maxPhotos}
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {selectedPhoto ? (
          <div className="space-y-4">
          <div className="overflow-hidden rounded-[18px] bg-slate-100 ring-1 ring-slate-200">
            <div className="relative">
              <div className="absolute left-3 top-3 z-10 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                {photos[0]?.id === selectedPhoto.id ? "Cover" : "Selected"}
              </div>
              <PhotoSurface
                src={getDraftDisplayUrl(selectedPhoto)}
                alt="Selected listing photo"
                className="aspect-[4/3]"
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Selected photo</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onRemovePhoto?.(selectedPhoto.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
                {canConfigureEnhancement ? (
                  <button
                    type="button"
                    onClick={() => onEnhancePhoto?.(selectedPhoto.id)}
                    disabled={selectedPhoto?.enhancement?.isProcessing}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    <Sparkles className="h-4 w-4" />
                    {selectedPhoto?.enhancement?.isProcessing ? "Enhancing..." : "Enhance photo"}
                  </button>
                ) : null}
              </div>
            </div>

            {canConfigureEnhancement ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Background:</span>
                  <div className="inline-flex flex-wrap overflow-hidden rounded-md border border-slate-200 bg-white">
                    {ENHANCEABLE_BACKGROUND_OPTIONS.map((option) => {
                      const isSelected = selectedPhoto?.enhancement?.background === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onBackgroundChange?.(selectedPhoto.id, option.value)}
                          className={`border-r border-slate-200 px-3 py-1.5 text-xs font-medium transition last:border-r-0 ${
                            isSelected
                              ? "bg-violet-600 text-white"
                              : "bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {hasUnsavedEnhancedPhoto ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Sparkles className="h-4 w-4 text-violet-600" />
                    <span className="font-medium text-slate-700">Enhanced photo</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChooseVariant?.(
                        selectedPhoto.id,
                        selectedPhoto.selectedVariant === "enhanced" ? "original" : "enhanced"
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {selectedPhoto.selectedVariant === "enhanced" ? "Use original" : "Use enhanced"}
                  </button>
                </div>
              </div>
            ) : null}

            {selectedPhoto?.enhancement?.error ? (
              <p className="text-sm text-rose-600">{selectedPhoto.enhancement.error}</p>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-end gap-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                {photos.length} / {maxPhotos}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {photos.map((photo, index) => {
                const isSelected = selectedPhoto?.id === photo.id;
                const isCover = index === 0;
                return (
                  <div key={photo.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPhotoId(photo.id)}
                      aria-label={isCover ? "Select cover photo" : `Select photo ${index + 1}`}
                      className={`block w-full overflow-hidden rounded-xl transition ${
                        isSelected
                          ? "scale-[1.02] shadow-md ring-2 ring-violet-500 ring-offset-1 ring-offset-white"
                          : "hover:scale-[1.01]"
                      }`}
                    >
                      <div className="relative overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                        {isCover ? (
                          <div className="absolute left-2 top-2 z-10 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm">
                            Cover
                          </div>
                        ) : null}
                        <PhotoSurface
                          src={getDraftDisplayUrl(photo)}
                          alt={`Listing photo ${index + 1}`}
                          className="aspect-square rounded-none"
                        />
                      </div>
                    </button>
                    <div className="space-y-1">
                      <p className="truncate text-xs font-medium text-slate-700">
                        {isCover ? "Cover" : `Photo ${index + 1}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed border-slate-300 bg-white px-6 py-10 text-center transition hover:border-violet-400"
        >
          <div className="rounded-full bg-slate-100 p-3">
            <ImagePlus className="h-6 w-6 text-slate-700" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-900">Add your first photo</p>
            <p className="text-sm text-slate-600">
              Upload product photos, then choose which one shoppers should see first.
            </p>
          </div>
        </label>
      )}

      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleFileChange}
      />
    </section>
  );
}

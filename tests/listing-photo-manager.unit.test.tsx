import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ListingPhotoManager from "@/components/business/listings/ListingPhotoManager";

beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:preview");
});

function buildPhoto(id, overrides = {}) {
  return {
    id,
    status: "new",
    original: {
      file: new File(["photo"], `${id}.jpg`, { type: "image/jpeg" }),
      previewUrl: `blob:${id}`,
    },
    enhanced: {
      publicUrl: `https://example.com/${id}-enhanced.png`,
    },
    selectedVariant: "enhanced",
    enhancement: {
      background: "white",
      isProcessing: false,
      error: "",
    },
    ...overrides,
  };
}

describe("ListingPhotoManager", () => {
  it("keeps upload secondary and avoids competing primary ctas", () => {
    render(
      <ListingPhotoManager
        photos={[
          buildPhoto("photo-1", {
            enhanced: { publicUrl: "" },
            selectedVariant: "original",
          }),
        ]}
        coverImageId="photo-1"
        maxPhotos={10}
        helperText="Choose a cover photo — this is what customers see first."
        error=""
        onAddFiles={vi.fn()}
        onRemovePhoto={vi.fn()}
        onEnhancePhoto={vi.fn()}
        onChooseVariant={vi.fn()}
        onBackgroundChange={vi.fn()}
        onSetCoverPhoto={vi.fn()}
        canAddMore
      />
    );

    expect(screen.getByText("Upload photos")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Enhance photo" })).toHaveLength(1);
    expect(screen.queryByText("Enhance options")).not.toBeInTheDocument();
    expect(screen.getByAltText("Selected listing photo").className).toContain("object-contain");
    expect(
      screen.queryByText("Choose a cover photo — this is what customers see first.")
    ).not.toBeInTheDocument();
  });

  it("shows enhanced controls only for the selected unsaved photo", () => {
    const onChooseVariant = vi.fn();

    render(
      <ListingPhotoManager
        photos={[
          buildPhoto("photo-1", {
            enhanced: { publicUrl: "" },
            selectedVariant: "original",
          }),
          buildPhoto("photo-2", { selectedVariant: "enhanced" }),
        ]}
        coverImageId="photo-1"
        maxPhotos={10}
        helperText="Choose a cover photo — this is what customers see first."
        error=""
        onAddFiles={vi.fn()}
        onRemovePhoto={vi.fn()}
        onEnhancePhoto={vi.fn()}
        onChooseVariant={onChooseVariant}
        onBackgroundChange={vi.fn()}
        onSetCoverPhoto={vi.fn()}
        canAddMore
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Select photo 2" }));
    expect(screen.queryByRole("button", { name: "Enhance photo" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use original" }));

    expect(onChooseVariant).toHaveBeenCalledWith("photo-2", "original");
    expect(screen.getByText("Enhanced photo")).toBeInTheDocument();
    expect(screen.getByText("Enhance options")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "Enhance photo" })).toHaveLength(0);
  });

  it("hides background and enhancement controls for saved photos", () => {
    render(
      <ListingPhotoManager
        photos={[
          buildPhoto("photo-1", {
            status: "existing",
            original: {
              file: null,
              previewUrl: "https://example.com/photo-1.jpg",
            },
          }),
        ]}
        coverImageId="photo-1"
        maxPhotos={10}
        helperText="Choose a cover photo — this is what customers see first."
        error=""
        onAddFiles={vi.fn()}
        onRemovePhoto={vi.fn()}
        onEnhancePhoto={vi.fn()}
        onChooseVariant={vi.fn()}
        onBackgroundChange={vi.fn()}
        onSetCoverPhoto={vi.fn()}
        canAddMore
      />
    );

    expect(screen.queryByText("Enhance options")).not.toBeInTheDocument();
    expect(screen.queryByText("Enhanced photo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enhance photo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("lets the user mark a thumbnail as the cover photo", () => {
    const onSetCoverPhoto = vi.fn();

    render(
      <ListingPhotoManager
        photos={[
          buildPhoto("photo-1", {
            enhanced: { publicUrl: "" },
            selectedVariant: "original",
          }),
          buildPhoto("photo-2", {
            enhanced: { publicUrl: "" },
            selectedVariant: "original",
          }),
        ]}
        coverImageId="photo-1"
        maxPhotos={10}
        helperText="Choose a cover photo."
        error=""
        onAddFiles={vi.fn()}
        onRemovePhoto={vi.fn()}
        onEnhancePhoto={vi.fn()}
        onChooseVariant={vi.fn()}
        onBackgroundChange={vi.fn()}
        onSetCoverPhoto={onSetCoverPhoto}
        canAddMore
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Set cover for photo 2" }));
    expect(onSetCoverPhoto).toHaveBeenCalledWith("photo-2");
    expect(screen.getAllByText("COVER").length).toBeGreaterThan(0);
  });

  it("reveals enhance options only after the user clicks enhance for the current photo", () => {
    const onEnhancePhoto = vi.fn();
    const onBackgroundChange = vi.fn();

    render(
      <ListingPhotoManager
        photos={[
          buildPhoto("photo-1", {
            enhanced: { publicUrl: "" },
            selectedVariant: "original",
          }),
        ]}
        coverImageId="photo-1"
        maxPhotos={10}
        helperText="Choose a cover photo."
        error=""
        onAddFiles={vi.fn()}
        onRemovePhoto={vi.fn()}
        onEnhancePhoto={onEnhancePhoto}
        onChooseVariant={vi.fn()}
        onBackgroundChange={onBackgroundChange}
        onSetCoverPhoto={vi.fn()}
        canAddMore
      />
    );

    expect(screen.queryByText("Enhance options")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Enhance photo" }));

    expect(onEnhancePhoto).toHaveBeenCalledWith("photo-1");
    expect(screen.getByText("Enhance options")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Soft gray" }));
    expect(onBackgroundChange).toHaveBeenCalledWith("photo-1", "soft_gray");
  });

  it("shows helper text only before any cover is resolved", () => {
    render(
      <ListingPhotoManager
        photos={[]}
        coverImageId={null}
        maxPhotos={10}
        helperText="Choose a cover photo."
        error=""
        onAddFiles={vi.fn()}
        onRemovePhoto={vi.fn()}
        onEnhancePhoto={vi.fn()}
        onChooseVariant={vi.fn()}
        onBackgroundChange={vi.fn()}
        onSetCoverPhoto={vi.fn()}
        canAddMore
      />
    );

    expect(screen.getByText("Choose a cover photo.")).toBeInTheDocument();
  });
});

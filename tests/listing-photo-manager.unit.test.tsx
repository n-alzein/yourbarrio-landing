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
        maxPhotos={10}
        helperText="Add up to 10 photos."
        error=""
        onAddFiles={vi.fn()}
        onRemovePhoto={vi.fn()}
        onEnhancePhoto={vi.fn()}
        onChooseVariant={vi.fn()}
        onBackgroundChange={vi.fn()}
        canAddMore
      />
    );

    expect(screen.getByText("Upload photos")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Enhance photo" })).toHaveLength(1);
    expect(screen.getByText("Background:")).toBeInTheDocument();
    expect(screen.getByAltText("Selected listing photo").className).toContain("object-contain");
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
        maxPhotos={10}
        helperText="Add up to 10 photos."
        error=""
        onAddFiles={vi.fn()}
        onRemovePhoto={vi.fn()}
        onEnhancePhoto={vi.fn()}
        onChooseVariant={onChooseVariant}
        onBackgroundChange={vi.fn()}
        canAddMore
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Select photo 2" }));
    expect(screen.queryByRole("button", { name: "Enhance photo" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use original" }));

    expect(onChooseVariant).toHaveBeenCalledWith("photo-2", "original");
    expect(screen.getByText("Enhanced photo")).toBeInTheDocument();
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
        maxPhotos={10}
        helperText="Add up to 10 photos."
        error=""
        onAddFiles={vi.fn()}
        onRemovePhoto={vi.fn()}
        onEnhancePhoto={vi.fn()}
        onChooseVariant={vi.fn()}
        onBackgroundChange={vi.fn()}
        canAddMore
      />
    );

    expect(screen.queryByText("Background:")).not.toBeInTheDocument();
    expect(screen.queryByText("Enhanced photo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enhance photo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });
});

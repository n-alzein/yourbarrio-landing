import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import NewListingPage from "@/app/(business)/business/listings/new/page";

let pushMock = vi.fn();
let mockSupabase = null;
let mockAuth = null;
let insertMock = vi.fn();
let updateMock = vi.fn();
let fetchMock = vi.fn();
let tempUploadCount = 0;
let uploadTemporaryImageMock = vi.fn();
let discardTemporaryImagesMock = vi.fn();
let commitTemporaryImagesMock = vi.fn();
const normalizeImageUploadMock = vi.fn(async (file) => file);
const prepareEnhancementImageMock = vi.fn(async (file) => ({
  file,
  optimized: false,
  dimensions: { width: 1200, height: 1200 },
}));
const describeImageFileMock = vi.fn((file) => ({
  name: file?.name || null,
  type: file?.type || null,
  size: file?.size || null,
}));

const newListingSource = readFileSync(
  path.join(process.cwd(), "app/(business)/business/listings/new/page.jsx"),
  "utf8"
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: () => mockSupabase,
}));

vi.mock("@/lib/normalizeImageUpload", () => ({
  normalizeImageUpload: (...args) => normalizeImageUploadMock(...args),
  prepareEnhancementImage: (...args) => prepareEnhancementImageMock(...args),
  describeImageFile: (...args) => describeImageFileMock(...args),
}));

vi.mock("@/lib/images/tempMediaClient", () => ({
  uploadTemporaryImage: (...args) => uploadTemporaryImageMock(...args),
  discardTemporaryImages: (...args) => discardTemporaryImagesMock(...args),
  commitTemporaryImages: (...args) => commitTemporaryImagesMock(...args),
}));

function buildUploadTemporaryImageMock() {
  return vi.fn(async ({ file }) => {
    tempUploadCount += 1;
    const assetId = `temp-asset-${tempUploadCount}`;
    await mockSupabase?.storage
      ?.from("listing-photos")
      ?.upload(
        `user-1-${Date.now()}-${file.name}`,
        file,
        expect.objectContaining({ contentType: file.type || "image/jpeg" })
      );
    return {
      ok: true,
      previewUrl: `https://example.com/${file.name}`,
      asset: {
        id: assetId,
        source_path: `tmp/user-1/session/${assetId}/source`,
      },
      upload_session_id: "session-1",
    };
  });
}

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props) => {
    const {
      fill,
      priority,
      placeholder,
      blurDataURL,
      sizes,
      decoding,
      fetchPriority,
      ...rest
    } = props;
    return <img alt="" {...rest} />;
  },
}));

vi.mock("@/components/editor/RichTextDescriptionEditor", () => ({
  __esModule: true,
  default: ({ value, onChange, onBlur, label }) => (
    <textarea
      aria-label={label || "Description"}
      value={value || ""}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={onBlur}
    />
  ),
}));

function makeSupabaseMock({ insertError } = {}) {
  const upload = vi.fn(async () => ({
    data: { path: "listing-photos/1.jpg", fullPath: "listing-photos/1.jpg" },
    error: null,
  }));
  const getPublicUrl = vi.fn((path = "listing-photos/1.jpg") => ({
    data: { publicUrl: `https://example.com/${path.split("/").pop()}` },
  }));

  const usersQuery = {
    select: vi.fn(() => usersQuery),
    eq: vi.fn(() => usersQuery),
    single: vi.fn(async () => ({
      data: { city: "Austin" },
      error: null,
    })),
  };
  const businessesQuery = {
    select: vi.fn(() => businessesQuery),
    eq: vi.fn(() => businessesQuery),
    maybeSingle: vi.fn(async () => ({
      data: {
        pickup_enabled_default: true,
        local_delivery_enabled_default: false,
        default_delivery_fee_cents: 500,
      },
      error: null,
    })),
  };
  const listingCategoriesQuery = {
    select: vi.fn(() => listingCategoriesQuery),
    eq: vi.fn(() => listingCategoriesQuery),
    maybeSingle: vi.fn(async () => ({
      data: {
        id: "category-clothing",
        slug: "clothing-fashion",
        name: "Clothing & Fashion",
      },
      error: null,
    })),
  };

  insertMock = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({
        data: insertError ? null : { id: "listing-1" },
        error: insertError || null,
      })),
    })),
  }));
  updateMock = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(async () => ({ data: null, error: null })),
    })),
  }));

  return {
    storage: {
      from: vi.fn(() => ({ upload, getPublicUrl })),
    },
    from: vi.fn((table) => {
      if (table === "businesses") return businessesQuery;
      if (table === "users") return usersQuery;
      if (table === "listing_categories") return listingCategoriesQuery;
      if (table === "listings") return { insert: insertMock, update: updateMock };
      return { insert: insertMock };
    }),
    rpc: vi.fn(async () => ({ error: null })),
  };
}

async function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Listing title"), {
    target: { value: "Cold brew" },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Small batch concentrate." },
  });
  await screen.findByRole("option", { name: "Clothing & Fashion" });
  fireEvent.change(screen.getByLabelText("Category"), {
    target: { value: "clothing-fashion" },
  });
  fireEvent.change(screen.getByLabelText("Price"), {
    target: { value: "12" },
  });
  fireEvent.change(screen.getByLabelText("Quantity on hand"), {
    target: { value: "4" },
  });
}

async function addPhoto(container) {
  const fileInput = container.querySelector('input[type="file"]');
  const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
  fireEvent.change(fileInput, { target: { files: [file] } });
  await screen.findByRole("button", { name: "Enhance photo" });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function getLatestListingMediaUpdatePayload() {
  return updateMock.mock.calls.at(-1)?.[0] || insertMock.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  pushMock = vi.fn();
  mockSupabase = null;
  mockAuth = null;
  insertMock = vi.fn();
  updateMock = vi.fn();
  fetchMock = vi.fn();
  tempUploadCount = 0;
  uploadTemporaryImageMock = buildUploadTemporaryImageMock();
  discardTemporaryImagesMock = vi.fn(async () => ({ ok: true, deleted: 1 }));
  commitTemporaryImagesMock = vi.fn(async ({ assetIds }) => ({
    ok: true,
    listingPhotoVariants: assetIds.map((assetId) => ({
      id: assetId,
      media_asset_id: assetId,
      original: {
        url: `https://example.com/${assetId}/detail_1200.webp`,
        path: `user-1/listings/listing-1/${assetId}/detail_1200.webp`,
      },
      variants: {
        thumb_320: `https://example.com/${assetId}/thumb_320.webp`,
        card_640: `https://example.com/${assetId}/card_640.webp`,
        detail_1200: `https://example.com/${assetId}/detail_1200.webp`,
      },
      selectedVariant: "original",
    })),
  }));
  normalizeImageUploadMock.mockReset();
  normalizeImageUploadMock.mockImplementation(async (file) => file);
  prepareEnhancementImageMock.mockReset();
  prepareEnhancementImageMock.mockImplementation(async (file) => ({
    file,
    optimized: false,
    dimensions: { width: 1200, height: 1200 },
  }));
  describeImageFileMock.mockReset();
  describeImageFileMock.mockImplementation((file) => ({
    name: file?.name || null,
    type: file?.type || null,
    size: file?.size || null,
  }));
  global.fetch = fetchMock;
  if (!global.URL.createObjectURL) {
    global.URL.createObjectURL = vi.fn(() => "blob:preview");
  } else {
    global.URL.createObjectURL = vi.fn(() => "blob:preview");
  }
  if (!global.URL.revokeObjectURL) {
    global.URL.revokeObjectURL = vi.fn();
  } else {
    global.URL.revokeObjectURL = vi.fn();
  }
  if (!global.crypto) {
    global.crypto = {};
  }
  if (!global.crypto.randomUUID) {
    global.crypto.randomUUID = vi.fn(() => "uuid");
  } else {
    global.crypto.randomUUID = vi.fn(() => "uuid");
  }
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("NewListingPage", () => {
  it("keeps inventory quantity and status handlers synchronized", () => {
    expect(newListingSource).toContain("syncInventoryFormFromStatus");
    expect(newListingSource).toContain("syncInventoryFormFromQuantity");
    expect(newListingSource).toContain("getManualInventoryState");
  });

  it("keeps preview disabled until a saved draft exists", () => {
    expect(newListingSource).toContain("Preview listing");
    expect(newListingSource).toContain("Save draft first to preview latest changes.");
    expect(newListingSource).toContain('title="Save draft first to preview latest changes."');
    expect(newListingSource).toContain('target="_blank"');
    expect(newListingSource).toContain('/preview?fromEditor=1');
  });

  it("defaults new listings to pickup on and delivery off", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    render(<NewListingPage />);

    expect(await screen.findByRole("tab", { name: "Pickup" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "Delivery" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByRole("tab", { name: "Both" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("does not auto-run enhancement on upload", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    expect(container.querySelector('input[type="file"]')).not.toHaveAttribute("capture");
    await addPhoto(container);

    expect(await screen.findByRole("button", { name: "Enhance photo" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("selecting a photo immediately renders a local preview while upload is pending", async () => {
    const upload = deferred();
    uploadTemporaryImageMock = vi.fn(() => upload.promise);
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    const fileInput = container.querySelector('input[type="file"]');
    fireEvent.change(fileInput, {
      target: { files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })] },
    });

    const selectedPreview = await screen.findByAltText("Selected listing photo");
    expect(selectedPreview).toHaveAttribute("src", "blob:preview");
    expect(screen.getAllByText("Uploading...").length).toBeGreaterThan(0);
    expect(insertMock).not.toHaveBeenCalled();
    expect(commitTemporaryImagesMock).not.toHaveBeenCalled();
  });

  it("keeps the preview visible during delayed upload and swaps to remote after success", async () => {
    const upload = deferred();
    uploadTemporaryImageMock = vi.fn(() => upload.promise);
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    const fileInput = container.querySelector('input[type="file"]');
    fireEvent.change(fileInput, {
      target: { files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })] },
    });

    expect(await screen.findByAltText("Selected listing photo")).toHaveAttribute(
      "src",
      "blob:preview"
    );

    upload.resolve({
      ok: true,
      previewUrl: "https://example.com/temp-photo.jpg",
      asset: {
        id: "temp-asset-1",
        source_path: "tmp/user-1/session/temp-asset-1/source",
      },
      upload_session_id: "session-1",
    });

    await waitFor(() => {
      expect(screen.getByAltText("Selected listing photo")).toHaveAttribute(
        "src",
        "https://example.com/temp-photo.jpg"
      );
    });
    expect(container.querySelector('img[aria-hidden="true"]')).toHaveAttribute("src", "blob:preview");

    fireEvent.load(screen.getByAltText("Selected listing photo"));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("failed upload keeps the local preview visible and blocks saving", async () => {
    uploadTemporaryImageMock = vi.fn(async () => {
      throw new Error("Upload failed. Try again.");
    });
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    const fileInput = container.querySelector('input[type="file"]');
    fireEvent.change(fileInput, {
      target: { files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })] },
    });

    expect(await screen.findByAltText("Selected listing photo")).toHaveAttribute(
      "src",
      "blob:preview"
    );
    expect(await screen.findAllByText("Upload failed. Try again.")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("removing a pending photo revokes local preview without server discard", async () => {
    const upload = deferred();
    uploadTemporaryImageMock = vi.fn(() => upload.promise);
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    const fileInput = container.querySelector('input[type="file"]');
    fireEvent.change(fileInput, {
      target: { files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })] },
    });
    await screen.findByAltText("Selected listing photo");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
    expect(discardTemporaryImagesMock).not.toHaveBeenCalled();
  });

  it("removing an uploaded temp photo revokes local preview and discards temp media", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    await addPhoto(container);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
    expect(discardTemporaryImagesMock).toHaveBeenCalledWith({ assetIds: ["temp-asset-1"] });
  });

  it("uploading a photo creates temporary media only and does not create a listing row", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    await addPhoto(container);

    expect(screen.getByRole("button", { name: "Enhance photo" })).toBeInTheDocument();
    expect(insertMock).not.toHaveBeenCalled();
    expect(commitTemporaryImagesMock).not.toHaveBeenCalled();
  });

  it("leaving an unsaved create session discards temp media and does not create an untitled draft", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    await addPhoto(container);

    fireEvent.click(screen.getByTestId("listing-editor-exit"));

    await waitFor(() => {
      expect(discardTemporaryImagesMock).toHaveBeenCalledWith(expect.objectContaining({
        assetIds: ["temp-asset-1"],
        uploadSessionId: expect.stringMatching(/^listing-create-/),
      }));
    });
    expect(window.confirm).toHaveBeenCalledWith(
      "Discard this unsaved listing and any pending photo uploads?"
    );
    expect(insertMock).not.toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/business/listings");
  });

  it("clicking an internal nav link uses the same discard confirmation before navigation", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(
      <>
        <a href="/business/dashboard" onClick={(event) => event.preventDefault()}>
          Dashboard
        </a>
        <NewListingPage />
      </>
    );
    await addPhoto(container);

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));

    await waitFor(() => {
      expect(discardTemporaryImagesMock).toHaveBeenCalledWith(expect.objectContaining({
        assetIds: ["temp-asset-1"],
        uploadSessionId: expect.stringMatching(/^listing-create-/),
      }));
    });
    expect(window.confirm).toHaveBeenCalledWith(
      "Discard this unsaved listing and any pending photo uploads?"
    );
    expect(pushMock).toHaveBeenCalledWith("/business/dashboard");
  });

  it("canceling internal nav keeps the user on create page and leaves previews intact", async () => {
    window.confirm.mockReturnValueOnce(false);
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(
      <>
        <a href="/business/orders">Orders</a>
        <NewListingPage />
      </>
    );
    await addPhoto(container);

    fireEvent.click(screen.getByRole("link", { name: "Orders" }));

    expect(discardTemporaryImagesMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByAltText("Selected listing photo")).toBeInTheDocument();
  });

  it("browser unload warns when temp media exists", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    await addPhoto(container);

    const event = new Event("beforeunload", { cancelable: true });
    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("browser back confirmation can cancel and keep the create page active", async () => {
    window.confirm.mockReturnValueOnce(false);
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };
    const pushStateSpy = vi.spyOn(window.history, "pushState");

    const { container } = render(<NewListingPage />);
    await addPhoto(container);

    fireEvent.popState(window, { state: {} });

    expect(window.confirm).toHaveBeenCalledWith(
      "Discard this unsaved listing and any pending photo uploads?"
    );
    expect(discardTemporaryImagesMock).not.toHaveBeenCalled();
    expect(pushStateSpy).toHaveBeenCalled();
    pushStateSpy.mockRestore();
  });

  it("cancelling the leave confirmation keeps the unsaved create session open", async () => {
    window.confirm.mockReturnValueOnce(false);
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    await addPhoto(container);

    fireEvent.click(screen.getByTestId("listing-editor-exit"));

    expect(discardTemporaryImagesMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("normalizes HEIC uploads before preview and publish", async () => {
    const normalizedFile = new File(["jpeg"], "photo.jpg", { type: "image/jpeg" });
    normalizeImageUploadMock.mockResolvedValue(normalizedFile);
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    const fileInput = container.querySelector('input[type="file"]');
    const heicFile = new File(["heic"], "photo.heic", { type: "image/heic" });

    fireEvent.change(fileInput, { target: { files: [heicFile] } });

    expect(await screen.findByRole("button", { name: "Enhance photo" })).toBeInTheDocument();
    expect(normalizeImageUploadMock).toHaveBeenCalledWith(
      heicFile,
      expect.objectContaining({
        source: "desktop_upload",
        inputControl: "listing-photo-primary",
        captureAttributePresent: false,
      })
    );

    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    const storageFrom = mockSupabase.storage.from;
    const uploadMock = storageFrom.mock.results[0].value.upload;
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/photo\.jpg$/),
      normalizedFile,
      expect.objectContaining({ contentType: "image/jpeg" })
    );
  });

  it("uses the latest normalized file for enhancement when multiple photos are added", async () => {
    const firstNormalized = new File(["jpeg-1"], "first.jpg", { type: "image/jpeg" });
    const secondNormalized = new File(["jpeg-2"], "second.jpg", { type: "image/jpeg" });
    global.crypto.randomUUID
      .mockImplementationOnce(() => "uuid-1")
      .mockImplementationOnce(() => "uuid-2");
    normalizeImageUploadMock
      .mockResolvedValueOnce(firstNormalized)
      .mockResolvedValueOnce(secondNormalized);
    fetchMock.mockImplementation(async (_url, options) => {
      const body = options?.body;
      return {
        ok: true,
        json: async () => ({
          ok: true,
          image: {
            publicUrl:
              body?.get("image")?.name === "second.jpg"
                ? "https://example.com/second-enhanced.png"
                : "https://example.com/first-enhanced.png",
            path: "enhanced/user-1/photo.png",
          },
          enhancement: {
            background: "white",
            lighting: "auto",
            shadow: "subtle",
          },
        }),
      };
    });
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    const fileInput = container.querySelector('input[type="file"]');

    fireEvent.change(fileInput, {
      target: { files: [new File(["one"], "first.heic", { type: "image/heic" })] },
    });
    await screen.findByRole("button", { name: "Enhance photo" });

    fireEvent.change(fileInput, {
      target: { files: [new File(["two"], "second.heic", { type: "image/heic" })] },
    });
    await screen.findByRole("button", { name: "Select photo 2" });
    fireEvent.click(screen.getByRole("button", { name: "Select photo 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Enhance photo" }));

    await waitFor(() => {
      const [, request] = fetchMock.mock.calls.at(-1);
      expect(request.body.get("image").name).toBe(secondNormalized.name);
      expect(request.body.get("image").type).toBe(secondNormalized.type);
      expect(request.body.get("mediaAssetId")).toBe("temp-asset-2");
    });
  });

  it("shows a friendly error when HEIC normalization fails", async () => {
    normalizeImageUploadMock.mockRejectedValue(
      new Error(
        "We couldn’t process this iPhone photo automatically. Please try another photo, or set your iPhone camera format to Most Compatible."
      )
    );
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    const fileInput = container.querySelector('input[type="file"]');
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["heic"], "photo.heic", { type: "image/heic" })],
      },
    });

    expect(
      await screen.findByText(
        "We couldn’t process this iPhone photo automatically. Please try another photo, or set your iPhone camera format to Most Compatible."
      )
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets the business keep the original after previewing an enhanced photo", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        image: {
          publicUrl: "https://example.com/enhanced-photo.png",
          path: "enhanced/user-1/enhanced-photo.png",
        },
        enhancement: {
          background: "white",
          lighting: "auto",
          shadow: "subtle",
        },
      }),
    });
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    await addPhoto(container);

    fireEvent.click(await screen.findByRole("button", { name: "Enhance photo" }));
    await screen.findByRole("button", { name: "Use original" });

    fireEvent.click(screen.getByRole("button", { name: "Use original" }));
    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const firstPayload = getLatestListingMediaUpdatePayload();
    expect(JSON.parse(firstPayload.photo_url)[0]).toMatch(
      /^https:\/\/example\.com\/temp-asset-\d+\/detail_1200\.webp$/
    );
    expect(firstPayload.photo_variants[0].enhanced.url).toBe(
      "https://example.com/enhanced-photo.png"
    );
  });

  it("does not select enhanced when the enhancement response is unusable", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        ok: false,
        error: {
          message: "We couldn't enhance this photo right now. You can keep the original and continue.",
        },
      }),
    });
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    await addPhoto(container);

    fireEvent.click(await screen.findByRole("button", { name: "Enhance photo" }));

    expect(
      await screen.findByText("We couldn't enhance this photo right now. You can keep the original and continue.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use original" })).not.toBeInTheDocument();

    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const payload = getLatestListingMediaUpdatePayload();
    expect(payload.photo_variants[0].selectedVariant).toBe("original");
  });

  it("uses the enhanced photo when the business applies it", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        image: {
          publicUrl: "https://example.com/enhanced-photo.png",
          path: "enhanced/user-1/enhanced-photo.png",
        },
        enhancement: {
          background: "white",
          lighting: "auto",
          shadow: "subtle",
        },
      }),
    });
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);
    await addPhoto(container);

    fireEvent.click(await screen.findByRole("button", { name: "Enhance photo" }));
    await screen.findByRole("button", { name: "Use original" });

    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const payload = getLatestListingMediaUpdatePayload();
    expect(JSON.parse(payload.photo_url)).toEqual(["https://example.com/enhanced-photo.png"]);
    expect(payload.photo_variants[0].selectedVariant).toBe("enhanced");
  });

  it("clears loading state and shows error on publish failure", async () => {
    mockSupabase = makeSupabaseMock({
      insertError: { message: "Insert failed" },
    });
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);

    await fillRequiredFields();
    await addPhoto(container);

    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Publish listing" })).toBeEnabled();
    });

    expect(commitTemporaryImagesMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Insert failed");
  });

  it("shows a concise publish helper when required fields are missing", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    render(<NewListingPage />);

    expect(screen.getByRole("button", { name: "Publish listing" })).toBeEnabled();
    expect(
      screen.getByText("Add a title, a price, a category, and a photo to publish.")
    ).toBeInTheDocument();
  });

  it("typing a title does not reveal unrelated required-field errors", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    render(<NewListingPage />);

    fireEvent.change(screen.getByLabelText("Listing title"), {
      target: { value: "Cold brew" },
    });

    expect(screen.queryByText("Add at least one photo.")).not.toBeInTheDocument();
    expect(screen.queryByText("Add a description.")).not.toBeInTheDocument();
    expect(screen.queryByText("Select a category.")).not.toBeInTheDocument();
    expect(screen.queryByText("Add a price.")).not.toBeInTheDocument();
  });

  it("blurring an empty description shows only the description required error", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    render(<NewListingPage />);

    fireEvent.blur(screen.getByLabelText("Description"));

    expect(screen.getByText("Add a description.")).toBeInTheDocument();
    expect(screen.queryByText("Add at least one photo.")).not.toBeInTheDocument();
    expect(screen.queryByText("Select a category.")).not.toBeInTheDocument();
    expect(screen.queryByText("Add a price.")).not.toBeInTheDocument();
  });

  it("clicking Publish on an incomplete listing shows all required errors and blocks save", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    render(<NewListingPage />);

    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));

    await waitFor(() => {
      expect(screen.getAllByText("Add a listing title.").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Add at least one photo.")).toBeInTheDocument();
    expect(screen.getByText("Add a description.")).toBeInTheDocument();
    expect(screen.getByText("Select a category.")).toBeInTheDocument();
    expect(screen.getByText("Add a price.")).toBeInTheDocument();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("saving a draft does not show full required-field errors or block incomplete drafts", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    render(<NewListingPage />);

    fireEvent.change(screen.getByLabelText("Listing title"), {
      target: { value: "Cold brew" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });
    expect(screen.queryByText("Add at least one photo.")).not.toBeInTheDocument();
    expect(screen.queryByText("Add a description.")).not.toBeInTheDocument();
    expect(screen.queryByText("Select a category.")).not.toBeInTheDocument();
    expect(screen.queryByText("Add a price.")).not.toBeInTheDocument();
  });

  it("still publishes with the original photo when enhancement fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        error: {
          message: "Enhancement unavailable",
        },
      }),
    });
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);

    await addPhoto(container);
    fireEvent.click(await screen.findByRole("button", { name: "Enhance photo" }));
    expect(await screen.findByText("Enhancement unavailable")).toBeInTheDocument();

    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/business/listings");
    });

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const payload = getLatestListingMediaUpdatePayload();
    expect(JSON.parse(payload.photo_url)[0]).toMatch(
      /^https:\/\/example\.com\/temp-asset-\d+\/detail_1200\.webp$/
    );
  });

  it("redirects after successful publish", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);

    await fillRequiredFields();
    await addPhoto(container);

    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/business/listings");
    });

    const payload = insertMock.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        status: "published",
      })
    );
    expect(commitTemporaryImagesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assetIds: ["temp-asset-1"],
        listingId: "listing-1",
        businessId: "user-1",
        purpose: "listing_image",
      })
    );
    expect(payload).not.toHaveProperty("is_published");
  });

  it("saves drafts with draft status and without publishing", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);

    await fillRequiredFields();
    await addPhoto(container);

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    const payload = insertMock.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        status: "draft",
      })
    );
    expect(commitTemporaryImagesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assetIds: ["temp-asset-1"],
        listingId: "listing-1",
        businessId: "user-1",
        purpose: "listing_image",
      })
    );
    expect(payload).not.toHaveProperty("is_published");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("does not prompt or discard after successful Save draft", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);

    await fillRequiredFields();
    await addPhoto(container);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    window.confirm.mockClear();
    discardTemporaryImagesMock.mockClear();

    const event = new Event("beforeunload", { cancelable: true });
    fireEvent(window, event);

    expect(window.confirm).not.toHaveBeenCalled();
    expect(discardTemporaryImagesMock).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("persists an explicitly selected cover photo", async () => {
    global.crypto.randomUUID
      .mockImplementationOnce(() => "uuid-1")
      .mockImplementationOnce(() => "uuid-2");
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);

    await fillRequiredFields();
    await addPhoto(container);
    await addPhoto(container);

    fireEvent.click(screen.getByRole("button", { name: "Set cover for photo 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const payload = getLatestListingMediaUpdatePayload();
    expect(payload.cover_image_id).toBe("draft-uuid-2");
    expect(payload.photo_variants[0].id).toBe("draft-uuid-2");
  });

  it("falls back to the next available photo when the current cover is removed", async () => {
    global.crypto.randomUUID
      .mockImplementationOnce(() => "uuid-1")
      .mockImplementationOnce(() => "uuid-2");
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);

    await fillRequiredFields();
    await addPhoto(container);
    await addPhoto(container);

    fireEvent.click(screen.getByRole("button", { name: "Set cover for photo 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Select cover photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const payload = getLatestListingMediaUpdatePayload();
    expect(payload.cover_image_id).toBe("draft-uuid-1");
    expect(payload.photo_variants[0].id).toBe("draft-uuid-1");
  });

  it("renders transient saved feedback in the action area after saving a draft", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);

    await fillRequiredFields();
    await addPhoto(container);

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    const actionStatus = await screen.findByTestId("listing-editor-action-status");
    await waitFor(() => {
      expect(actionStatus).toHaveTextContent("Saved");
    });
    expect(screen.getByTestId("listing-editor-exit")).not.toHaveTextContent("Saved");

    await waitFor(
      () => {
        expect(actionStatus).not.toHaveTextContent("Saved");
      },
      { timeout: 3000 }
    );
  });

  it("enables publish when all required fields are present", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    const { container } = render(<NewListingPage />);

    await fillRequiredFields();
    await addPhoto(container);

    expect(screen.getByRole("button", { name: "Publish listing" })).toBeEnabled();
    expect(
      screen.queryByText("Add a title, a price, a category, and a photo to publish.")
    ).not.toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NewListingPage from "@/app/(business)/business/listings/new/page";

let pushMock = vi.fn();
let mockSupabase = null;
let mockAuth = null;
let insertMock = vi.fn();
let fetchMock = vi.fn();

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
  default: ({ value, onChange, label }) => (
    <textarea
      aria-label={label || "Description"}
      value={value || ""}
      onChange={(event) => onChange?.(event.target.value)}
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

  insertMock = vi.fn(async () => ({
    error: insertError || null,
  }));

  return {
    storage: {
      from: vi.fn(() => ({ upload, getPublicUrl })),
    },
    from: vi.fn((table) => {
      if (table === "businesses") return businessesQuery;
      if (table === "users") return usersQuery;
      if (table === "listings") return { insert: insertMock };
      return { insert: insertMock };
    }),
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
}

function addPhoto(container) {
  const fileInput = container.querySelector('input[type="file"]');
  const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
  fireEvent.change(fileInput, { target: { files: [file] } });
}

beforeEach(() => {
  pushMock = vi.fn();
  mockSupabase = null;
  mockAuth = null;
  insertMock = vi.fn();
  fetchMock = vi.fn();
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
});

describe("NewListingPage", () => {
  it("defaults new listings to pickup on and delivery off", async () => {
    mockSupabase = makeSupabaseMock();
    mockAuth = {
      supabase: mockSupabase,
      user: { id: "user-1" },
      profile: null,
      loadingUser: false,
    };

    render(<NewListingPage />);

    expect(
      await screen.findByRole("checkbox", { name: /pickup available/i })
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /local delivery available/i })
    ).not.toBeChecked();
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
    addPhoto(container);

    expect(await screen.findByRole("button", { name: "Enhance photo" })).toBeInTheDocument();
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
    addPhoto(container);

    fireEvent.click(await screen.findByRole("button", { name: "Enhance photo" }));
    await screen.findByRole("button", { name: "Use enhanced photo" });

    fireEvent.click(screen.getByRole("button", { name: "Keep original" }));
    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    const firstPayload = insertMock.mock.calls[0][0];
    expect(JSON.parse(firstPayload.photo_url)[0]).toMatch(
      /^https:\/\/example\.com\/user-1-.*-photo\.jpg$/
    );
    expect(firstPayload.photo_variants[0].enhanced.url).toBe(
      "https://example.com/enhanced-photo.png"
    );
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
    addPhoto(container);

    fireEvent.click(await screen.findByRole("button", { name: "Enhance photo" }));
    await screen.findByRole("button", { name: "Use enhanced photo" });

    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
    });

    const payload = insertMock.mock.calls[0][0];
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
    addPhoto(container);

    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Publish listing" })).toBeEnabled();
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Insert failed");
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

    addPhoto(container);
    fireEvent.click(await screen.findByRole("button", { name: "Enhance photo" }));
    expect(await screen.findByText("Enhancement unavailable")).toBeInTheDocument();

    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/business/listings");
    });

    const payload = insertMock.mock.calls[0][0];
    expect(JSON.parse(payload.photo_url)[0]).toMatch(
      /^https:\/\/example\.com\/user-1-.*-photo\.jpg$/
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
    addPhoto(container);

    fireEvent.click(screen.getByRole("button", { name: "Publish listing" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/business/listings");
    });
  });
});

import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BusinessProfilePage from "@/components/business/profile/BusinessProfilePage";

const businessProfileViewMock = vi.fn(({ mode }) => (
  <div data-testid="shared-business-profile-view">{mode}</div>
));
const updateMock = vi.hoisted(() => vi.fn());
const refreshProfileMock = vi.hoisted(() => vi.fn());
const updateProfileMock = vi.hoisted(() => vi.fn());
const uploadTemporaryImageMock = vi.hoisted(() => vi.fn());
const commitTemporaryImagesMock = vi.hoisted(() => vi.fn());
const discardTemporaryImagesMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    supabase: null,
    user: { id: "00000000-0000-0000-0000-000000000111" },
    profile: null,
    refreshProfile: refreshProfileMock,
    updateProfile: updateProfileMock,
  }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: () => ({
    from: vi.fn(() => ({
      update: updateMock,
    })),
    storage: {},
  }),
}));

vi.mock("@/lib/images/tempMediaClient", () => ({
  uploadTemporaryImage: uploadTemporaryImageMock,
  commitTemporaryImages: commitTemporaryImagesMock,
  discardTemporaryImages: discardTemporaryImagesMock,
}));

vi.mock("@/lib/ids/publicRefs", () => ({
  getBusinessPublicUrl: () => "/b/shop-111",
}));

vi.mock("@/components/business/profile-system/ProfileSystem", () => ({
  ProfilePageShell: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/components/publicBusinessProfile/BusinessProfileView", () => ({
  __esModule: true,
  default: (props) => businessProfileViewMock(props),
}));

vi.mock("@/components/business/profile/OverviewEditor", () => ({
  __esModule: true,
  default: () => <div>Overview editor</div>,
}));

vi.mock("@/components/business/profile/GalleryManager", () => ({
  __esModule: true,
  default: () => <div>Gallery manager</div>,
}));

vi.mock("@/components/business/profile/AnnouncementsManager", () => ({
  __esModule: true,
  default: () => <div>Announcements manager</div>,
}));

describe("BusinessProfilePage", () => {
  beforeEach(() => {
    businessProfileViewMock.mockClear();
    refreshProfileMock.mockClear();
    updateProfileMock.mockClear();
    uploadTemporaryImageMock.mockReset();
    commitTemporaryImagesMock.mockReset();
    discardTemporaryImagesMock.mockReset();
    discardTemporaryImagesMock.mockResolvedValue({ ok: true, deleted: 1 });
    updateMock.mockReset();
    updateMock.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  it("renders the shared canonical profile view in owner mode", () => {
    render(
      <BusinessProfilePage
        initialProfile={{
          id: "00000000-0000-0000-0000-000000000111",
          business_name: "Barrio Boutique",
        }}
        initialGallery={[]}
        initialReviews={[]}
        initialListings={[]}
        initialAnnouncements={[]}
        ratingSummary={{ count: 0, average: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }}
      />
    );

    expect(screen.getByTestId("shared-business-profile-view")).toHaveTextContent("owner");
    expect(businessProfileViewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "owner",
      })
    );
  });

  it("persists avatar media asset id when the owner uploads a business avatar", async () => {
    uploadTemporaryImageMock.mockResolvedValue({
      asset: { id: "temp-avatar-1" },
    });
    commitTemporaryImagesMock.mockResolvedValue({
      profileUrl: "https://cdn.example.com/avatar_256.webp",
      assets: [
        {
          id: "avatar-asset-1",
          bucket: "business-photos",
          purpose: "business_avatar",
          avatar_512_path: "owner/avatar/avatar-asset-1/avatar_512.webp",
        },
      ],
    });

    render(
      <BusinessProfilePage
        initialProfile={{
          id: "00000000-0000-0000-0000-000000000111",
          business_name: "Barrio Boutique",
          profile_photo_url: "",
          avatar_media_asset_id: null,
        }}
        initialGallery={[]}
        initialReviews={[]}
        initialListings={[]}
        initialAnnouncements={[]}
        ratingSummary={{ count: 0, average: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }}
      />
    );

    const latestProps = businessProfileViewMock.mock.calls.at(-1)?.[0];
    await act(async () => {
      await latestProps.heroProps.onAvatarUpload(
        new File(["avatar"], "avatar.png", { type: "image/png" })
      );
    });

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({
        profile_photo_url: "https://cdn.example.com/avatar_256.webp",
        avatar_media_asset_id: "avatar-asset-1",
      });
    });
    expect(uploadTemporaryImageMock).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "business_avatar" })
    );
    expect(commitTemporaryImagesMock).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "business_avatar" })
    );
    expect(updateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "00000000-0000-0000-0000-000000000111",
        profile_photo_url: "https://cdn.example.com/avatar_256.webp",
        avatar_media_asset_id: "avatar-asset-1",
        business_avatar_media_asset: expect.objectContaining({
          avatar_512_path: "owner/avatar/avatar-asset-1/avatar_512.webp",
        }),
      })
    );
    await waitFor(() => {
      const rerenderedProps = businessProfileViewMock.mock.calls.at(-1)?.[0];
      expect(rerenderedProps.profile).toMatchObject({
        profile_photo_url: "https://cdn.example.com/avatar_256.webp",
        avatar_media_asset_id: "avatar-asset-1",
        business_avatar_media_asset: expect.objectContaining({
          avatar_512_path: "owner/avatar/avatar-asset-1/avatar_512.webp",
        }),
      });
    });
  });

  it("discards an uncommitted header upload when commit fails", async () => {
    uploadTemporaryImageMock.mockResolvedValue({
      asset: { id: "temp-cover-1" },
    });
    commitTemporaryImagesMock.mockRejectedValue(new Error("commit failed"));

    render(
      <BusinessProfilePage
        initialProfile={{
          id: "00000000-0000-0000-0000-000000000111",
          business_name: "Barrio Boutique",
          profile_photo_url: "",
          cover_photo_url: "",
        }}
        initialGallery={[]}
        initialReviews={[]}
        initialListings={[]}
        initialAnnouncements={[]}
        ratingSummary={{ count: 0, average: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }}
      />
    );

    const latestProps = businessProfileViewMock.mock.calls.at(-1)?.[0];
    await act(async () => {
      await latestProps.heroProps.onCoverUpload(
        new File(["cover"], "cover.png", { type: "image/png" })
      );
    });

    expect(discardTemporaryImagesMock).toHaveBeenCalledWith({ assetIds: ["temp-cover-1"] });
    expect(updateMock).not.toHaveBeenCalled();
  });
});

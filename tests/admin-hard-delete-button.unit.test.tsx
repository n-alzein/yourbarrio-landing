import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HardDeleteFakeTestAccountButton from "@/app/admin/users/[id]/_components/HardDeleteFakeTestAccountButton";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

describe("HardDeleteFakeTestAccountButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        preview: {
          counts: {
            user_profile: 1,
            auth_account: 1,
            businesses: 2,
            listings: 18,
            reviews: 4,
            conversations: 6,
            messages: 42,
            cart_items: 9,
            reservations: 3,
            media_assets: 27,
            storage_files: 54,
          },
        },
      }),
    }) as any;
  });

  it("hides the action from non-super admins", () => {
    render(
      <HardDeleteFakeTestAccountButton
        targetUserId="user-1"
        actorRoleKeys={["admin_ops"]}
        isEligible
      />
    );

    expect(screen.queryByText("Hard delete fake/test account")).not.toBeInTheDocument();
  });

  it("shows disabled blocked state for ineligible users", () => {
    render(
      <HardDeleteFakeTestAccountButton
        targetUserId="user-1"
        actorRoleKeys={["admin_super"]}
        isEligible={false}
      />
    );

    expect(screen.getByRole("button", { name: "Hard delete fake/test account" })).toBeDisabled();
    expect(screen.getByText(/not marked as fake, test, or internal/i)).toBeInTheDocument();
  });

  it("shows dry-run counts in the modal", async () => {
    render(
      <HardDeleteFakeTestAccountButton
        targetUserId="user-1"
        actorRoleKeys={["admin_super"]}
        isEligible
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Hard delete fake/test account" }));

    expect(await screen.findByText("User profile")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("54")).toBeInTheDocument();
  });

  it("requires confirmation before execute", async () => {
    render(
      <HardDeleteFakeTestAccountButton
        targetUserId="user-1"
        actorRoleKeys={["admin_super"]}
        isEligible
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Hard delete fake/test account" }));
    await screen.findByText("Type HARD DELETE USER to continue");
    const executeButtons = screen.getAllByRole("button", {
      name: "Hard delete fake/test account",
    });
    const executeButton = executeButtons[executeButtons.length - 1];

    expect(executeButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type HARD DELETE USER to continue"), {
      target: { value: "HARD DELETE USER" },
    });
    expect(executeButton).not.toBeDisabled();
  });

  it("routes back to accounts after success", async () => {
    render(
      <HardDeleteFakeTestAccountButton
        targetUserId="user-1"
        actorRoleKeys={["admin_super"]}
        isEligible
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Hard delete fake/test account" }));
    await screen.findByText("Listings");
    fireEvent.change(screen.getByLabelText("Type HARD DELETE USER to continue"), {
      target: { value: "HARD DELETE USER" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Hard delete fake/test account" })[1]);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/accounts"));
  });
});

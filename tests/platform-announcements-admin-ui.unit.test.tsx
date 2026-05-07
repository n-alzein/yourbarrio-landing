import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnnouncementsAdminClient from "@/app/admin/announcements/AnnouncementsAdminClient";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function row(overrides: Record<string, any> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Maintenance",
    message: "YourBarrio may be briefly unavailable tonight.",
    cta_label: "Status",
    cta_href: "/status",
    audience: "all",
    variant: "warning",
    priority: 75,
    starts_at: null,
    ends_at: null,
    dismissible: true,
    status: "draft",
    created_at: "2026-05-06T10:00:00.000Z",
    updated_at: "2026-05-06T10:00:00.000Z",
    ...overrides,
  };
}

function mockSaveResponse(status = "active") {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      announcement: row({
        status,
        updated_at: "2026-05-06T11:00:00.000Z",
      }),
    }),
  } as Response);
}

describe("AnnouncementsAdminClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("renders the announcement list, selected row, status badge, and NoticeBanner preview", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "active" })]} roles={["admin_ops"]} showInlinePageHeader />);

    expect(screen.getByRole("heading", { name: "Announcements" })).toBeInTheDocument();
    expect(screen.getByText("Platform banners")).toBeInTheDocument();
    const newButton = screen.getByRole("button", { name: "+ New announcement" });
    expect(newButton).toBeEnabled();
    expect(newButton).toHaveClass("!bg-indigo-600");
    expect(newButton).toHaveClass("!text-white");
    expect(screen.getAllByText("YourBarrio may be briefly unavailable tonight.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Maintenance/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("combobox", { name: /status/i })).not.toBeInTheDocument();
  });

  it("can render the top page header with a visible new action", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row()]} roles={["admin_ops"]} showInlinePageHeader />);

    expect(screen.getByRole("heading", { name: "Announcements" })).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "+ New announcement" });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toBeEnabled();
    expect(buttons[0]).toHaveClass("!bg-indigo-600");
    expect(buttons[0]).toHaveClass("!text-white");
  });

  it("renders the major editor sections", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row()]} roles={["admin_ops"]} />);

    for (const name of ["Preview", "Content", "Targeting", "Schedule"]) {
      const heading = screen.getByRole("heading", { name });
      expect(heading).toBeInTheDocument();
      expect(heading).not.toHaveClass("uppercase");
    }
  });

  it("shows title and schedule helper text", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row()]} roles={["admin_ops"]} />);

    expect(screen.getByText("Optional. If blank, the message is used as the internal list label.")).toBeInTheDocument();
    expect(screen.getByText("Leave both blank for an always-on banner.")).toBeInTheDocument();
  });

  it("shows Always on when starts and ends are blank", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ starts_at: null, ends_at: null })]} roles={["admin_ops"]} />);

    expect(screen.getByText("Always on")).toBeInTheDocument();
    expect(screen.getByLabelText("Starts")).toHaveValue("");
    expect(screen.getByLabelText("Ends")).toHaveValue("");
    expect(screen.getByLabelText("Starts")).toHaveAttribute("placeholder", "Optional start");
    expect(screen.getByLabelText("Ends")).toHaveAttribute("placeholder", "Optional end");
  });

  it("shows a compact schedule summary when starts and ends are populated", () => {
    render(
      <AnnouncementsAdminClient
        initialAnnouncements={[
          row({
            starts_at: "2026-05-06T12:00:00.000Z",
            ends_at: "2026-05-06T13:00:00.000Z",
          }),
        ]}
        roles={["admin_ops"]}
      />
    );

    expect(screen.queryByText("Always on")).not.toBeInTheDocument();
    expect(screen.getAllByText((content) => content.includes("May") && content.includes("–")).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Starts")).toHaveValue("2026-05-06T12:00");
    expect(screen.getByLabelText("Ends")).toHaveValue("2026-05-06T13:00");
  });

  it("uses a concise message fallback when title is blank", () => {
    const message = "Planned maintenance tonight may briefly interrupt checkout and account access.";
    render(
      <AnnouncementsAdminClient
        initialAnnouncements={[
          row({
            title: null,
            message,
          }),
        ]}
        roles={["admin_ops"]}
      />
    );

    const listRow = screen.getByRole("button", {
      name: /Planned maintenance tonight may briefly interrupt checkout/i,
    });
    expect(listRow).toHaveTextContent("Planned maintenance tonight may briefly interrupt checkout...");
    expect(listRow).toHaveTextContent("No title");
    expect(listRow).not.toHaveTextContent(message);
  });

  it("shows a useful empty state", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[]} roles={["admin_ops"]} showInlinePageHeader />);

    expect(screen.getByText("No announcements yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first platform banner for guests, customers, or businesses.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "+ New announcement" })).toHaveLength(1);
  });

  it("New announcement resets the editor to draft defaults", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "active" })]} roles={["admin_ops"]} showInlinePageHeader />);

    fireEvent.click(screen.getByRole("button", { name: "+ New announcement" }));

    expect(screen.getByRole("heading", { name: "New announcement" })).toBeInTheDocument();
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/^Title/)).toHaveValue("");
    expect(screen.getByLabelText(/Message/)).toHaveValue("");
    expect(screen.getByLabelText("CTA label")).toHaveValue("");
    expect(screen.getByLabelText("CTA href")).toHaveValue("");
    expect(screen.getByLabelText("Audience")).toHaveValue("all");
    expect(screen.getByLabelText("Variant")).toHaveValue("info");
    expect(screen.getByLabelText("Priority")).toHaveValue(50);
    expect(screen.getByLabelText("Dismissible")).toBeChecked();
  });

  it("uses overflow-safe full-width field classes in the editor", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row()]} roles={["admin_ops"]} />);

    expect(screen.getByLabelText("CTA href")).toHaveClass("w-full");
    expect(screen.getByLabelText("CTA href")).toHaveClass("min-w-0");
    expect(screen.getByLabelText("Audience")).toHaveClass("w-full");
    expect(screen.getByLabelText("Variant")).toHaveClass("w-full");
    expect(screen.getByLabelText("Starts")).toHaveClass("w-full");
    expect(screen.getByLabelText("Ends")).toHaveClass("w-full");
  });

  it("draft announcements show Publish, Save draft, and Archive actions", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "draft" })]} roles={["admin_ops"]} />);

    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("active announcements show Save changes, Unpublish to draft, and Archive actions", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "active" })]} roles={["admin_ops"]} />);

    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpublish to draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("archived announcements show Restore as draft and Save changes", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "archived" })]} roles={["admin_ops"]} />);

    expect(screen.getByRole("button", { name: "Restore as draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("disables publishing controls for support admins", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "draft" })]} roles={["admin_support"]} />);

    expect(screen.getByText("Support can view announcements. Publishing is disabled for this role.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("shows validation guidance when publish is disabled by invalid fields", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "draft" })]} roles={["admin_ops"]} showInlinePageHeader />);

    fireEvent.click(screen.getByRole("button", { name: "+ New announcement" }));

    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.getByText("Message is required before publishing.")).toBeInTheDocument();
    expect(screen.getByText("Add a message and fix validation errors before publishing.")).toBeInTheDocument();
  });

  it("shows CTA and schedule validation messages inline", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "draft" })]} roles={["admin_ops"]} />);

    fireEvent.change(screen.getByLabelText("CTA href"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "2026-05-06T12:00" } });
    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "2026-05-06T11:00" } });

    expect(screen.getByText("Add a CTA href when a CTA label is present.")).toBeInTheDocument();
    expect(screen.getByText("End time must be after start time.")).toBeInTheDocument();
  });

  it("warns when CTA href is present without CTA label", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "draft", cta_label: null, cta_href: "/status" })]} roles={["admin_ops"]} />);

    expect(screen.getByText("CTA href is ignored until a CTA label is added.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Status" })).not.toBeInTheDocument();
  });

  it("previews a CTA only when both label and href are set", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "draft" })]} roles={["admin_ops"]} />);

    expect(screen.getAllByRole("link", { name: "Status" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Status" })[0]).toHaveAttribute("href", "/status");

    fireEvent.change(screen.getByLabelText("CTA label"), { target: { value: "" } });

    expect(screen.queryByRole("link", { name: "Status" })).not.toBeInTheDocument();
  });

  it("clears CTA href when CTA label is cleared", () => {
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "draft" })]} roles={["admin_ops"]} />);

    fireEvent.change(screen.getByLabelText("CTA label"), { target: { value: "" } });

    expect(screen.getByLabelText("CTA href")).toHaveValue("");
  });

  it("Publish saves the current fields with active status", async () => {
    mockSaveResponse("active");
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "draft" })]} roles={["admin_ops"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.status).toBe("active");
  });

  it("Unpublish to draft saves with draft status", async () => {
    mockSaveResponse("draft");
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "active" })]} roles={["admin_ops"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Unpublish to draft" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.status).toBe("draft");
  });

  it("Archive saves with archived status", async () => {
    mockSaveResponse("archived");
    render(<AnnouncementsAdminClient initialAnnouncements={[row({ status: "active" })]} roles={["admin_ops"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.status).toBe("archived");
  });
});

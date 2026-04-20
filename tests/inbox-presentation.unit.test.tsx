import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InboxList from "@/components/messages/InboxList";
import {
  classifyInboxItem,
  formatLegacyOrderUpdatePreview,
  splitInboxConversations,
} from "@/components/messages/inboxPresentation";

const prefetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    prefetch: prefetchMock,
  }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, prefetch, ...rest }) => {
    void prefetch;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

const baseConversation = {
  customer_unread_count: 0,
  business_unread_count: 0,
  last_message_at: "2026-04-19T16:30:00.000Z",
};

function makeConversation(overrides = {}) {
  return {
    ...baseConversation,
    id: overrides.id || "conversation-1",
    business: {
      business_name: overrides.businessName || "Test ABCD",
      profile_photo_url: "",
    },
    customer: {
      full_name: overrides.customerName || "Test Customer",
      profile_photo_url: "",
    },
    last_message_preview: overrides.preview || "Can you confirm pickup?",
    ...overrides,
  };
}

describe("inbox presentation helpers", () => {
  it("shortens obvious legacy order update messages", () => {
    expect(
      formatLegacyOrderUpdatePreview(
        "Order YB-8XQZ4Y update: Your order status is now Fulfilled."
      )
    ).toBe("Order YB-8XQZ4Y fulfilled");
  });

  it("keeps uncertain previews active and unchanged", () => {
    const preview = "Can you update me on order YB-8XQZ4Y?";

    expect(formatLegacyOrderUpdatePreview(preview)).toBe(preview);
    expect(classifyInboxItem({ last_message_preview: preview })).toBe(
      "conversation"
    );
  });

  it("uses explicit system order metadata when available", () => {
    expect(
      classifyInboxItem({
        last_message_type: "system_order_update",
        last_message_sender_role: "system",
      })
    ).toBe("order_update");

    expect(
      classifyInboxItem({
        sender_role: "system",
        system_event: "order_status",
      })
    ).toBe("order_update");
  });

  it("keeps human-authored threads as conversations even with order text", () => {
    expect(
      classifyInboxItem({
        last_message_preview:
          "Order YB-8XQZ4Y update: Your order status is now Fulfilled.",
        messages: [{ sender_role: "business", message_type: "text" }],
      })
    ).toBe("conversation");
  });

  it("splits conversations without reordering within each group", () => {
    const active = makeConversation({
      id: "active-1",
      last_message_sender_role: "customer",
      last_message_type: "text",
    });
    const update = makeConversation({
      id: "update-1",
      last_message_sender_role: "system",
      last_message_type: "system_order_update",
      preview: "Order YB-8XQZ4Y update: Your order status is now Fulfilled.",
    });
    const uncertain = makeConversation({
      id: "active-2",
      preview: "Order YB-8XQZ4Y update?",
    });

    expect(splitInboxConversations([active, update, uncertain])).toEqual({
      conversations: [active, uncertain],
      orderUpdates: [update],
    });
  });
});

describe("InboxList customer flat variant", () => {
  it("renders conversations and order updates separately", () => {
    render(
      <InboxList
        conversations={[
          makeConversation({
            id: "chat-1",
            businessName: "Barrio Bakery",
            last_message_sender_role: "customer",
            last_message_type: "text",
            preview: "Can you confirm pickup?",
          }),
          makeConversation({
            id: "update-1",
            businessName: "Test ABCD",
            last_message_sender_role: "system",
            last_message_type: "system_order_update",
            preview:
              "Order YB-8XQZ4Y update: Your order status is now Fulfilled.",
          }),
        ]}
        role="customer"
        basePath="/customer/messages"
        variant="customer-flat"
      />
    );

    const activeSection = screen
      .getByRole("heading", { name: "Conversations" })
      .closest("section");
    const updatesSection = screen
      .getByRole("heading", { name: "Order updates" })
      .closest("section");

    expect(within(activeSection).getByText("Barrio Bakery")).toBeInTheDocument();
    expect(within(activeSection).getByText("Can you confirm pickup?")).toBeInTheDocument();
    expect(within(updatesSection).getByText("Test ABCD")).toBeInTheDocument();
    expect(
      within(updatesSection).getByText("Order YB-8XQZ4Y fulfilled")
    ).toBeInTheDocument();
    expect(within(updatesSection).queryByRole("img")).not.toBeInTheDocument();
  });

  it("keeps uncertain order-looking messages in active conversations", () => {
    render(
      <InboxList
        conversations={[
          makeConversation({
            id: "chat-1",
            businessName: "Corner Shop",
            preview: "Order YB-8XQZ4Y update?",
          }),
        ]}
        role="customer"
        basePath="/customer/messages"
        variant="customer-flat"
      />
    );

    const activeSection = screen
      .getByRole("heading", { name: "Conversations" })
      .closest("section");

    expect(
      screen.queryByRole("heading", { name: "Order updates" })
    ).not.toBeInTheDocument();
    expect(within(activeSection).getByText("Corner Shop")).toBeInTheDocument();
    expect(
      within(activeSection).getByText("Order YB-8XQZ4Y update?")
    ).toBeInTheDocument();
  });

  it("shows a structured empty state when there are no inbox items", () => {
    render(
      <InboxList
        conversations={[]}
        role="customer"
        basePath="/customer/messages"
        variant="customer-flat"
      />
    );

    expect(screen.queryByRole("heading", { name: "Conversations" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Message a business" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Browse listings or visit a business profile to ask questions, confirm details, or check availability."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse listings" })).toHaveAttribute(
      "href",
      "/listings"
    );
    expect(screen.getByRole("link", { name: "View your orders" })).toHaveAttribute(
      "href",
      "/account/purchase-history"
    );
  });

  it("keeps order updates visible when there are no conversations", () => {
    render(
      <InboxList
        conversations={[
          makeConversation({
            id: "update-1",
            businessName: "Test ABCD",
            last_message_sender_role: "system",
            last_message_type: "system_order_update",
            preview:
              "Order YB-8XQZ4Y update: Your order status is now Fulfilled.",
          }),
        ]}
        role="customer"
        basePath="/customer/messages"
        variant="customer-flat"
      />
    );

    expect(screen.queryByRole("heading", { name: "Conversations" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Message a business" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recent order updates" })
    ).toBeInTheDocument();
    expect(screen.getByText("Order YB-8XQZ4Y fulfilled")).toBeInTheDocument();
  });

  it("shows a passive business empty state without customer CTAs", () => {
    render(
      <InboxList
        conversations={[]}
        role="business"
        basePath="/business/messages"
        variant="business-flat"
      />
    );

    expect(screen.queryByRole("heading", { name: "Conversations" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No messages yet" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "When customers message your business, conversations will appear here."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Customers can contact you directly from your listings.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Browse listings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View your orders" })).not.toBeInTheDocument();
  });

  it("renders business conversations with compact order updates", () => {
    render(
      <InboxList
        conversations={[
          makeConversation({
            id: "chat-1",
            customerName: "Nour Customer",
            last_message_sender_role: "customer",
            last_message_type: "text",
            preview: "Is this still available?",
          }),
          makeConversation({
            id: "update-1",
            customerName: "Order Customer",
            last_message_sender_role: "system",
            last_message_type: "system_order_update",
            preview:
              "Order YB-8XQZ4Y update: Your order status is now Fulfilled.",
          }),
        ]}
        role="business"
        basePath="/business/messages"
        variant="business-flat"
      />
    );

    const conversationSection = screen
      .getByRole("heading", { name: "Conversations" })
      .closest("section");
    const updatesSection = screen
      .getByRole("heading", { name: "Order updates" })
      .closest("section");

    expect(within(conversationSection).getByText("Nour Customer")).toBeInTheDocument();
    expect(within(conversationSection).getByText("Is this still available?")).toBeInTheDocument();
    expect(within(updatesSection).getByText("Order Customer")).toBeInTheDocument();
    expect(
      within(updatesSection).getByText("Order YB-8XQZ4Y fulfilled")
    ).toBeInTheDocument();
    expect(within(updatesSection).queryByRole("img")).not.toBeInTheDocument();
  });
});

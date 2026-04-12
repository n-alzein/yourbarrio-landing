import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const customerLoginFormMock = vi.fn(() => null);
const openModalMock = vi.fn();

vi.mock("@/components/modals/BaseModal", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/components/modals/ModalProvider", () => ({
  useModal: () => ({
    openModal: openModalMock,
  }),
}));

vi.mock("@/components/auth/CustomerLoginForm", () => ({
  __esModule: true,
  default: (props) => {
    customerLoginFormMock(props);
    return null;
  },
}));

import CustomerLoginModal from "@/components/modals/CustomerLoginModal";

describe("CustomerLoginModal next forwarding", () => {
  it("passes next through to CustomerLoginForm", () => {
    render(<CustomerLoginModal next="/b/test-shop?ref=hero" onClose={() => {}} />);

    expect(customerLoginFormMock).toHaveBeenCalledWith(
      expect.objectContaining({
        next: "/b/test-shop?ref=hero",
        onSuccess: expect.any(Function),
        onSwitchToSignup: expect.any(Function),
      })
    );
  });
});

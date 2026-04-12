import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const backMock = vi.fn();
const customerLoginModalMock = vi.fn(() => null);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: backMock,
  }),
  useSearchParams: () => new URLSearchParams("next=%2Fb%2Ftest-store%3Fpreview%3D1"),
}));

vi.mock("@/components/modals/CustomerLoginModal", () => ({
  __esModule: true,
  default: (props) => {
    customerLoginModalMock(props);
    return null;
  },
}));

import CustomerLoginInterceptPage from "@/app/@auth/(.)login/page";

describe("customer login intercept page", () => {
  it("forwards next to the modal login flow", () => {
    render(<CustomerLoginInterceptPage />);

    expect(customerLoginModalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        next: "/b/test-store?preview=1",
        onClose: expect.any(Function),
      })
    );
  });
});

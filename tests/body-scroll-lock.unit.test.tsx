import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useBodyScrollLock from "@/components/nav/useBodyScrollLock";

function ScrollLockProbe({
  locked,
  disableBackgroundScroll,
}: {
  locked: boolean;
  disableBackgroundScroll?: boolean;
}) {
  useBodyScrollLock(locked, { disableBackgroundScroll });
  return null;
}

function setViewportWidths({ innerWidth, clientWidth }: { innerWidth: number; clientWidth: number }) {
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(innerWidth);
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    value: clientWidth,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.removeAttribute("style");
  document.documentElement.removeAttribute("style");
});

describe("useBodyScrollLock", () => {
  it("does not change body scroll styles unless background scroll is explicitly disabled", () => {
    setViewportWidths({ innerWidth: 1200, clientWidth: 1183 });

    const { rerender } = render(<ScrollLockProbe locked />);

    expect(document.body.style.position).toBe("");
    expect(document.body.style.width).toBe("");
    expect(document.body.style.paddingRight).toBe("");
    expect(document.body.style.overflow).toBe("");

    rerender(<ScrollLockProbe locked={false} />);

    expect(document.body.style.overflow).toBe("");
  });

  it("hides overflow without fixed positioning when background scroll is explicitly disabled", () => {
    setViewportWidths({ innerWidth: 1200, clientWidth: 1183 });

    const { rerender } = render(
      <ScrollLockProbe locked disableBackgroundScroll />
    );

    expect(document.body.style.position).toBe("");
    expect(document.body.style.width).toBe("");
    expect(document.body.style.paddingRight).toBe("17px");
    expect(document.body.style.overflow).toBe("hidden");

    rerender(<ScrollLockProbe locked={false} disableBackgroundScroll />);

    expect(document.body.style.paddingRight).toBe("");
    expect(document.body.style.overflow).toBe("");
  });
});

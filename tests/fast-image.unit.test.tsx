import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FastImage from "@/components/FastImage";

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

describe("FastImage", () => {
  it("uses eager loading and high fetch priority when priority is set", () => {
    render(
      <FastImage
        src="/hero.jpg"
        alt="Hero"
        width={1200}
        height={800}
        priority
      />
    );
    const img = screen.getByAltText("Hero");
    expect(img.getAttribute("loading")).toBe("eager");
    expect(img.getAttribute("fetchpriority")).toBe("high");
  });

  it("falls back to lazy loading when not priority", () => {
    render(
      <FastImage
        src="/card.jpg"
        alt="Card"
        width={400}
        height={300}
      />
    );
    const img = screen.getByAltText("Card");
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("swaps to fallback on error", async () => {
    render(
      <FastImage
        src="/broken.jpg"
        alt="Broken"
        width={200}
        height={200}
        fallbackSrc="/fallback.png"
      />
    );
    const img = screen.getByAltText("Broken");
    fireEvent.error(img);
    await waitFor(() => {
      expect(img.getAttribute("src")).toBe("/fallback.png");
    });
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AIDescriptionAssistant from "@/components/business/AIDescriptionAssistant";

describe("AIDescriptionAssistant", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("sends existingDescription for populated business profile content and waits for manual apply", async () => {
    const onApply = vi.fn();
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ description: "A polished neighborhood boutique description." }),
    } as Response);

    render(
      <AIDescriptionAssistant
        type="business"
        name="Barrio Boutique"
        category="boutique"
        value="Friendly neighborhood style shop."
        onApply={onApply}
        context="business-profile"
      />
    );

    expect(screen.queryByText("Polished description")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Improve with AI" }));

    await screen.findByText("A polished neighborhood boutique description.");
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Use this" })).toBeInTheDocument();
    expect(screen.getByText("Polished description")).toBeInTheDocument();
    expect(screen.getByText("Refined for clarity and tone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adjust/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/description",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.any(String),
      })
    );

    const payload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(payload).toMatchObject({
      type: "business",
      surface: "business-profile",
      action: "generate",
      existingDescription: "Friendly neighborhood style shop.",
    });
  });

  it("applies listing suggestions locally as html only after Use this", async () => {
    const onApply = vi.fn();
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ description: "Fresh seasonal arrangement with ceramic vase." }),
    } as Response);

    render(
      <AIDescriptionAssistant
        type="listing"
        name="Spring Bouquet"
        category="flowers-plants"
        value=""
        onApply={onApply}
        context="listing-editor"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Help me write this" }));
    await screen.findByText("Fresh seasonal arrangement with ceramic vase.");
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Use this" }));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith(
        "<p>Fresh seasonal arrangement with ceramic vase.</p>"
      );
    });
  });

  it("shows refine options in a dropdown and requests the selected refinement", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ description: "First version." }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ description: "A tighter version." }),
      } as Response);

    render(
      <AIDescriptionAssistant
        type="business"
        name="Barrio Boutique"
        category="boutique"
        value=""
        onApply={vi.fn()}
        context="business-profile"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Help me write this" }));
    await screen.findByText("First version.");

    fireEvent.click(screen.getByRole("button", { name: /Adjust/ }));
    fireEvent.click(screen.getByRole("button", { name: "Shorter" }));

    await screen.findByText("A tighter version.");
    expect(screen.getByText("Made more concise")).toBeInTheDocument();

    const refinePayload = JSON.parse(fetchMock.mock.calls[1][1]?.body as string);
    expect(refinePayload.action).toBe("shorter");
  });

  it("shows the friendly daily limit message inline on 429 responses", async () => {
    const onApply = vi.fn();
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: "You’ve reached today’s AI description limit. You can try again tomorrow.",
      }),
    } as Response);

    render(
      <AIDescriptionAssistant
        type="business"
        name="Barrio Boutique"
        category="boutique"
        value=""
        onApply={onApply}
        context="business-profile"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Help me write this" }));

    expect(
      await screen.findByText(
        "AI suggestions will be available again tomorrow. You can still edit this manually."
      )
    ).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("treats an ok response with a body error as a failed generation", async () => {
    const onApply = vi.fn();
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        error: "AI suggestion unavailable right now. Please try again later.",
      }),
    } as Response);

    render(
      <AIDescriptionAssistant
        type="business"
        name="Barrio Boutique"
        category="boutique"
        value=""
        onApply={onApply}
        context="business-profile"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Help me write this" }));

    expect(
      await screen.findByText("AI suggestion unavailable right now. Please try again later.")
    ).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });
});

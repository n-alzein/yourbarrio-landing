import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/client-errors/route";

describe("/api/client-errors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs only sanitized client error diagnostics", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await POST(
      new Request("http://localhost:3000/api/client-errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "session=secret",
          Authorization: "Bearer secret",
        },
        body: JSON.stringify({
          source: "app-error",
          pathname: "/b/834bcb5d7c",
          name: "TypeError",
          message: "Cannot read properties of null",
          stack: ["TypeError: Cannot read properties of null", "at Profile", "at render", "extra"],
          digest: "abc123",
          matchedChunkSignature: false,
          userAgent: "Test Browser",
          timestamp: "2026-05-08T00:00:00.000Z",
          cookies: "session=secret",
          authorization: "Bearer secret",
        }),
      })
    );

    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledWith("[CLIENT_ERROR_DIAGNOSTIC]", {
      source: "app-error",
      pathname: "/b/834bcb5d7c",
      name: "TypeError",
      message: "Cannot read properties of null",
      stack: ["TypeError: Cannot read properties of null", "at Profile", "at render"],
      digest: "abc123",
      matchedChunkSignature: false,
      userAgent: "Test Browser",
      timestamp: "2026-05-08T00:00:00.000Z",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
  });

  it("rejects invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/client-errors", {
        method: "POST",
        body: "{",
      })
    );

    expect(response.status).toBe(400);
  });
});

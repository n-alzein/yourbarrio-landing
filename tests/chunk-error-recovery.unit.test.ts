import { describe, expect, it } from "vitest";
import {
  CHUNK_RECOVERY_GUARD_KEY,
  clearChunkRecoveryGuard,
  hasChunkRecoveryGuard,
  isChunkLoadError,
  markChunkRecoveryAttempted,
  shouldAttemptChunkRecovery,
} from "@/lib/chunkErrorRecovery";

describe("chunk error recovery", () => {
  it("detects common JavaScript and CSS chunk load failures", () => {
    expect(isChunkLoadError(new Error("Loading chunk 182 failed."))).toBe(true);
    expect(isChunkLoadError(new Error("CSS chunk load failed"))).toBe(true);
    expect(
      isChunkLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://example.test/_next/static/chunks/app/layout.js"
        )
      )
    ).toBe(true);
    expect(
      isChunkLoadError({
        reason: new Error(
          "Importing a module script failed. https://example.test/_next/static/chunks/app/page.js"
        ),
      })
    ).toBe(true);
    expect(
      isChunkLoadError({
        message:
          "Unable to preload CSS for https://example.test/_next/static/css/app.css",
      })
    ).toBe(true);
  });

  it("does not classify unrelated runtime errors as chunk failures", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of null"))).toBe(false);
    expect(isChunkLoadError({ message: "Unauthorized" })).toBe(false);
    expect(isChunkLoadError(new Error("Load failed"))).toBe(false);
    expect(isChunkLoadError(new Error("Failed to fetch"))).toBe(false);
    expect(isChunkLoadError(new Error("AbortError: The operation was aborted"))).toBe(false);
    expect(
      isChunkLoadError(
        new TypeError("Failed to fetch dynamically imported module")
      )
    ).toBe(false);
    expect(
      isChunkLoadError(
        new Error("Hydration failed because the server rendered HTML didn't match the client.")
      )
    ).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it("does not classify normal API auth failures as stale app asset failures", () => {
    expect(
      isChunkLoadError({
        name: "ApiError",
        message: "GET /api/me failed with 401 Unauthorized",
        status: 401,
      })
    ).toBe(false);
    expect(
      isChunkLoadError({
        message: "Failed to fetch dynamically imported module while handling /api/me",
        status: 401,
      })
    ).toBe(false);
    expect(
      isChunkLoadError({
        message: "GET /_next/static/chunks/app.js failed",
        status: 404,
      })
    ).toBe(true);
    expect(
      isChunkLoadError({
        message: "GET /business-photos/missing-avatar.jpg failed with 404",
      })
    ).toBe(false);
    expect(
      isChunkLoadError({
        message: "GET /business-gallery/missing-photo.jpg failed with 404",
      })
    ).toBe(false);
  });

  it("uses a sessionStorage guard to prevent recovery loops", () => {
    window.sessionStorage.clear();
    const error = new Error("ChunkLoadError: Loading chunk 99 failed.");

    expect(shouldAttemptChunkRecovery(error, window.sessionStorage)).toBe(true);
    markChunkRecoveryAttempted(window.sessionStorage);
    expect(window.sessionStorage.getItem(CHUNK_RECOVERY_GUARD_KEY)).toContain('"at"');
    expect(hasChunkRecoveryGuard(window.sessionStorage)).toBe(true);
    expect(shouldAttemptChunkRecovery(error, window.sessionStorage)).toBe(false);

    clearChunkRecoveryGuard(window.sessionStorage);
    expect(hasChunkRecoveryGuard(window.sessionStorage)).toBe(false);
  });

  it("ignores legacy or expired recovery guards so stale state cannot render refresh UI", () => {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(CHUNK_RECOVERY_GUARD_KEY, "1");
    expect(hasChunkRecoveryGuard(window.sessionStorage)).toBe(false);
    expect(window.sessionStorage.getItem(CHUNK_RECOVERY_GUARD_KEY)).toBe(null);

    window.sessionStorage.setItem(
      CHUNK_RECOVERY_GUARD_KEY,
      JSON.stringify({ at: Date.now() - 60_000 })
    );
    expect(hasChunkRecoveryGuard(window.sessionStorage)).toBe(false);
    expect(window.sessionStorage.getItem(CHUNK_RECOVERY_GUARD_KEY)).toBe(null);
  });
});

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
        new TypeError("Failed to fetch dynamically imported module")
      )
    ).toBe(true);
    expect(
      isChunkLoadError({
        reason: new Error("Importing a module script failed."),
      })
    ).toBe(true);
    expect(
      isChunkLoadError({
        target: { href: "https://example.test/_next/static/css/app.css" },
      })
    ).toBe(true);
  });

  it("does not classify unrelated runtime errors as chunk failures", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of null"))).toBe(false);
    expect(isChunkLoadError({ message: "Unauthorized" })).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it("uses a sessionStorage guard to prevent recovery loops", () => {
    window.sessionStorage.clear();
    const error = new Error("ChunkLoadError: Loading chunk 99 failed.");

    expect(shouldAttemptChunkRecovery(error, window.sessionStorage)).toBe(true);
    markChunkRecoveryAttempted(window.sessionStorage);
    expect(window.sessionStorage.getItem(CHUNK_RECOVERY_GUARD_KEY)).toBe("1");
    expect(hasChunkRecoveryGuard(window.sessionStorage)).toBe(true);
    expect(shouldAttemptChunkRecovery(error, window.sessionStorage)).toBe(false);

    clearChunkRecoveryGuard(window.sessionStorage);
    expect(hasChunkRecoveryGuard(window.sessionStorage)).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..");

describe("PWA foundation", () => {
  it("exposes an installable manifest with YourBarrio branding", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(repoRoot, "public/manifest.webmanifest"), "utf8")
    );

    expect(manifest.name).toBe("YourBarrio");
    expect(manifest.short_name).toBe("YourBarrio");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.background_color).toBe("#f6f7fb");
    expect(manifest.theme_color).toBe("#111827");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/YB_AppLogo.png", sizes: "851x863" }),
        expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192" }),
        expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512" }),
        expect.objectContaining({
          src: "/icons/icon-maskable-512.png",
          purpose: "maskable",
        }),
      ])
    );
  });

  it("keeps authenticated and mutating routes network-only in the service worker", () => {
    const sw = readFileSync(path.join(repoRoot, "public/sw.js"), "utf8");

    for (const route of [
      "/api/",
      "/auth/",
      "/oauth/",
      "/account",
      "/admin",
      "/business",
      "/cart",
      "/checkout",
      "/messages",
      "/onboarding",
      "/orders",
    ]) {
      expect(sw).toContain(`"${route}"`);
    }

    expect(sw).toContain('request.headers.has("authorization")');
    expect(sw).toContain('request.mode === "navigate"');
    expect(sw).toContain("networkFirstNavigation");
    expect(sw).not.toContain("beforeinstallprompt");
  });
});

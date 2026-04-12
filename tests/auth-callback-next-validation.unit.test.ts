import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function read(relPath: string) {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

describe("auth callback next validation", () => {
  it("allows safe internal public paths and rejects framework/api targets", () => {
    const src = read("app/api/auth/callback/route.js");

    expect(src).toContain('!path.startsWith("/api/")');
    expect(src).toContain('!path.startsWith("/_next/")');
    expect(src).toContain('!path.startsWith("/_vercel/")');
  });
});

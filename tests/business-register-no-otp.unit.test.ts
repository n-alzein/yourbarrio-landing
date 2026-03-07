import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("business register flow", () => {
  it("does not use supabase.auth.signInWithOtp and calls server magic-link endpoint", () => {
    const filePath = path.resolve(
      process.cwd(),
      "components/business-auth/BusinessRegisterClient.jsx"
    );
    const source = fs.readFileSync(filePath, "utf8");

    expect(source.includes("signInWithOtp(")).toBe(false);
    expect(source.includes('"/api/auth/business-magic-link"')).toBe(true);
  });
});

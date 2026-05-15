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

  it("uses explicit spacing for the check-your-email verification state", () => {
    const filePath = path.resolve(
      process.cwd(),
      "components/business-auth/BusinessRegisterClient.jsx"
    );
    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain('className="mt-12 sm:mt-16"');
    expect(source).toContain('className="mt-5 sm:mt-6 rounded-xl');
    expect(source).toContain('className="mt-5 sm:mt-6 text-sm text-slate-500"');
    expect(source).toContain('className="mt-4 flex flex-col gap-5 sm:mt-5"');
    expect(source).not.toContain('className="mt-4 space-y-5 sm:mt-5"');
    expect(source).not.toContain('className="mt-10 space-y-6"');
    expect(source).not.toContain('className="pt-1 flex flex-col gap-0"');
  });
});

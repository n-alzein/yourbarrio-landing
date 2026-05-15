import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("forgot password page layout", () => {
  it("keeps the reset button separated from the email input", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/(auth)/auth/forgot-password/page.js"),
      "utf8"
    );

    expect(source).toContain('<form className="mt-6" onSubmit={handleSubmit}>');
    expect(source).toContain('<div className="mt-4">');
    expect(source).toContain(
      'className="yb-primary-button inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold !text-white"'
    );
    expect(source).toContain('className="mt-6 text-sm text-slate-600"');
    expect(source).not.toContain('<form className="mt-6 space-y-4" onSubmit={handleSubmit}>');
  });
});

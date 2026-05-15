import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("set password page layout", () => {
  it("uses a uniform full-page auth background and explicit form spacing", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/set-password/SetPasswordClient.tsx"),
      "utf8"
    );

    expect(source).toContain('className="min-h-screen w-full bg-slate-50 text-slate-900"');
    expect(source).toContain(
      'className="flex min-h-screen w-full items-center justify-center px-4 py-12"'
    );
    expect(source).toContain('className="mt-12" onSubmit={handleSubmit}');
    expect(source).toContain('className="mt-7 space-y-2"');
    expect(source.match(/className="space-y-2"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain('className="pt-1 text-sm text-slate-500"');
    expect(source).toContain('className="mt-10 flex flex-col gap-4"');
    expect(source).toContain("inline-flex h-12 w-full");
    expect(source).not.toContain('className="mx-auto flex min-h-screen w-full max-w-5xl');
    expect(source).not.toContain('className="space-y-5"');
    expect(source).not.toContain('className="space-y-6"');
    expect(source).not.toContain('className="space-y-7"');
    expect(source).not.toContain('className="space-y-3"');
    expect(source).not.toContain('className="mt-8 flex flex-col gap-4"');
    expect(source).not.toContain('className="mt-6 space-y-4"');
    expect(source).not.toContain('className="mt-6 space-y-4" onSubmit={handleSubmit}');
  });
});

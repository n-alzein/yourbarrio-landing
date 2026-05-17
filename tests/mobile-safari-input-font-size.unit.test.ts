import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function walkFiles(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function isNonTextInput(tag: string) {
  return /\btype=["'](?:button|checkbox|color|file|hidden|image|radio|range|reset|submit)["']/.test(tag);
}

function hasUnsafeMobileTextClass(className: string) {
  if (/\b(?:text-base|text-\[16px\])\b/.test(className)) return false;
  if (/\b(?:text-xs|text-sm)\b/.test(className)) return true;

  const arbitraryPx = className.match(/\btext-\[(\d+(?:\.\d+)?)px\]/g) || [];
  return arbitraryPx.some((token) => {
    const size = Number(token.match(/(\d+(?:\.\d+)?)/)?.[1]);
    return Number.isFinite(size) && size < 16;
  });
}

describe("mobile Safari form control font sizes", () => {
  it("keeps a mobile-only 16px guard for focusable text-like controls", () => {
    const globals = read("app/globals.css");
    const layout = read("app/layout.js");

    expect(globals).toContain("@media (max-width: 767px)");
    expect(globals).toContain("font-size: 16px !important");
    expect(globals).toContain("select");
    expect(globals).toContain("textarea");
    expect(globals).toContain("[contenteditable=\"\"]");
    expect(globals).toContain("[role=\"combobox\"]");
    expect(globals).not.toMatch(/maximum-scale\s*=\s*1|user-scalable\s*=\s*no/);
    expect(layout).toContain('content="width=device-width, initial-scale=1"');
    expect(layout).not.toMatch(/maximum-scale\s*=\s*1|user-scalable\s*=\s*no/);
  });

  it("keeps shared form field classes mobile-safe", () => {
    expect(read("components/auth/authFormStyles.js")).toContain("text-base");
    expect(read("app/(customer)/customer/settings/page.js")).toContain("text-base text-slate-900");
    expect(read("app/(business)/business/settings/page.js")).toContain("text-base text-slate-900");
    expect(read("app/(business)/business/listings/new/page.jsx")).toContain("text-base text-slate-900");
    expect(read("app/(business)/business/listings/[id]/edit/page.js")).toContain("text-base text-slate-900");
  });

  it("does not leave single-line raw text-like fields with only sub-16px mobile text classes", () => {
    const failures: string[] = [];
    const sourceFiles = [
      ...walkFiles(path.join(repoRoot, "app")),
      ...walkFiles(path.join(repoRoot, "components")),
    ];

    for (const filePath of sourceFiles) {
      const source = fs.readFileSync(filePath, "utf8");
      const controlMatches = source.matchAll(/<(input|textarea|select)\b[\s\S]*?>/g);

      for (const match of controlMatches) {
        const [tag, tagName] = match;
        if (tagName === "input" && isNonTextInput(tag)) continue;
        const className = tag.match(/className=(["'])([\s\S]*?)\1/)?.[2];
        if (!className) continue;
        if (!hasUnsafeMobileTextClass(className)) continue;

        const line = source.slice(0, match.index).split("\n").length;
        failures.push(`${path.relative(repoRoot, filePath)}:${line} ${className}`);
      }
    }

    expect(failures).toEqual([]);
  });
});

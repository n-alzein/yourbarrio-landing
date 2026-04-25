import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const editListingSource = readFileSync(
  path.join(process.cwd(), "app/(business)/business/listings/[id]/edit/page.js"),
  "utf8"
);

describe("Edit listing save flow", () => {
  it("renders inline save errors instead of relying on browser alerts", () => {
    expect(editListingSource).toContain('const [submitError, setSubmitError] = useState("");');
    expect(editListingSource).toContain('role="alert"');
    expect(editListingSource).toContain(
      'setSubmitError(err.message || "Failed to save changes. Please try again.");'
    );
    expect(editListingSource).not.toContain("alert(");
  });

  it("keeps the edit save pipeline wired through listing update and variant persistence", () => {
    expect(editListingSource).toContain("<form onSubmit={handleSubmit}");
    expect(editListingSource).toContain('.from("listings")');
    expect(editListingSource).toContain(".update(payload)");
    expect(editListingSource).toContain('.eq("id", internalListingId)');
    expect(editListingSource).toContain("await saveListingVariants(");
    expect(editListingSource).toContain('router.push("/business/listings")');
  });
});

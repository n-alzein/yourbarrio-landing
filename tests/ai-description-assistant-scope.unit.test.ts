import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const onboardingSource = readFileSync(
  path.join(process.cwd(), "app/(onboarding)/onboarding/OnboardingClient.jsx"),
  "utf8"
);

const newListingSource = readFileSync(
  path.join(process.cwd(), "app/(business)/business/listings/new/page.jsx"),
  "utf8"
);

const editListingSource = readFileSync(
  path.join(process.cwd(), "app/(business)/business/listings/[id]/edit/page.js"),
  "utf8"
);

const overviewEditorSource = readFileSync(
  path.join(process.cwd(), "components/business/profile/OverviewEditor.jsx"),
  "utf8"
);

describe("AI description assistant integration scope", () => {
  it("wires onboarding through the shared business assistant", () => {
    expect(onboardingSource).toContain('import AIDescriptionAssistant');
    expect(onboardingSource).toContain('<AIDescriptionAssistant');
    expect(onboardingSource).toContain('context="onboarding"');
    expect(onboardingSource).toContain('type="business"');
  });

  it("wires both listing create and edit through the shared listing assistant", () => {
    expect(newListingSource).toContain('import AIDescriptionAssistant');
    expect(newListingSource).toContain('context="listing-editor"');
    expect(newListingSource).toContain('type="listing"');
    expect(editListingSource).toContain('import AIDescriptionAssistant');
    expect(editListingSource).toContain('context="listing-editor"');
    expect(editListingSource).toContain('type="listing"');
  });

  it("wires business profile editing through the shared assistant near the description field", () => {
    expect(overviewEditorSource).toContain('import AIDescriptionAssistant');
    expect(overviewEditorSource).toContain('context="business-profile"');
    expect(overviewEditorSource).toContain('type="business"');
    expect(overviewEditorSource).toContain("setIsDirty(true);");
  });
});

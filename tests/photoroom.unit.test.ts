import { describe, expect, it } from "vitest";
import { buildPhotoroomEditFormData } from "@/lib/server/photoroom";

describe("buildPhotoroomEditFormData", () => {
  it("shapes an enhanced background request for white and soft shadow", () => {
    const file = new File(["photo"], "listing.jpg", { type: "image/jpeg" });
    const formData = buildPhotoroomEditFormData({
      image: file,
      background: "white",
    });

    const appendedFile = formData.get("imageFile");
    expect(appendedFile).toBeInstanceOf(File);
    expect(appendedFile?.name).toBe("listing.jpg");
    expect(formData.get("removeBackground")).toBe("true");
    expect(formData.get("background.color")).toBe("FFFFFF");
    expect(formData.get("lighting.mode")).toBe("ai.auto");
    expect(formData.get("shadow.mode")).toBe("ai.soft");
  });

  it("keeps the original background mode explicit", () => {
    const file = new File(["photo"], "listing.jpg", { type: "image/jpeg" });
    const formData = buildPhotoroomEditFormData({
      image: file,
      background: "original",
    });

    expect(formData.get("removeBackground")).toBe("false");
    expect(formData.get("background.color")).toBeNull();
    expect(formData.get("shadow.mode")).toBeNull();
  });
});

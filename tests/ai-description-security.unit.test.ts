import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/description/route";

const {
  getBusinessDataClientForRequestMock,
} = vi.hoisted(() => ({
  getBusinessDataClientForRequestMock: vi.fn(),
}));

vi.mock("@/lib/business/getBusinessDataClientForRequest", () => ({
  getBusinessDataClientForRequest: getBusinessDataClientForRequestMock,
}));

function walkFiles(rootDir: string, results: string[] = []) {
  for (const entry of readdirSync(rootDir)) {
    if (entry === "node_modules" || entry === ".git" || entry === ".next") continue;
    const fullPath = path.join(rootDir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walkFiles(fullPath, results);
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

function createRequest(body = {}) {
  return new Request("http://localhost:3000/api/ai/description", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "business",
      surface: "business-profile",
      action: "generate",
      name: "Barrio Boutique",
      category: "boutique",
      ...body,
    }),
  });
}

describe("AI description route security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-openai-key";
    delete process.env.OPENAI_DESCRIPTION_ASSISTANT_MODEL;
    vi.stubGlobal("fetch", vi.fn());
  });

  it("rejects unauthenticated requests before calling OpenAI", async () => {
    getBusinessDataClientForRequestMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });

    const response = await POST(createRequest() as never);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("keeps OPENAI_API_KEY and direct OpenAI calls out of client components", () => {
    const sourceRoots = ["app", "components", "lib"].map((dir) =>
      path.join(process.cwd(), dir)
    );
    const sourceFiles = sourceRoots.flatMap((rootDir) => walkFiles(rootDir));

    const envKeyViolations: string[] = [];
    const publicEnvViolations: string[] = [];
    const directOpenAiViolations: string[] = [];

    for (const filePath of sourceFiles) {
      if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) continue;
      const source = readFileSync(filePath, "utf8");
      const isClientFile = /^["']use client["'];/.test(source.trimStart());

      if (source.includes("NEXT_PUBLIC_OPENAI_API_KEY")) {
        publicEnvViolations.push(filePath);
      }

      if (!isClientFile) continue;

      if (source.includes("OPENAI_API_KEY")) {
        envKeyViolations.push(filePath);
      }
      if (
        source.includes("api.openai.com") ||
        /from\s+["']openai["']/.test(source) ||
        /require\(["']openai["']\)/.test(source)
      ) {
        directOpenAiViolations.push(filePath);
      }
    }

    expect(publicEnvViolations).toEqual([]);
    expect(envKeyViolations).toEqual([]);
    expect(directOpenAiViolations).toEqual([]);
  });
});

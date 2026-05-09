import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import AppErrorFallback from "@/components/AppErrorFallback";
import { ChunkRecoveryFallback } from "@/components/ChunkErrorRecovery";

const appErrorSource = readFileSync(path.join(process.cwd(), "app/error.js"), "utf8");
const globalErrorSource = readFileSync(path.join(process.cwd(), "app/global-error.js"), "utf8");

describe("app error UI", () => {
  it("shows the generic branded error for non-chunk route errors", () => {
    render(<AppErrorFallback reset={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText("This page hit an unexpected issue.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go home" })).toBeInTheDocument();
    expect(screen.queryByText("We need one more refresh")).not.toBeInTheDocument();
    expect(screen.queryByText(/latest app files/i)).not.toBeInTheDocument();
  });

  it("uses the stale app files message only for real chunk-load errors", () => {
    render(<ChunkRecoveryFallback mode="failed" />);

    expect(screen.getByText("We need one more refresh")).toBeInTheDocument();
    expect(screen.getByText(/latest app files/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).not.toBeInTheDocument();
  });

  it("wires app and global error files to the generic state outside chunk detection", () => {
    expect(appErrorSource).toContain("if (isChunkError)");
    expect(appErrorSource).toContain("<AppErrorFallback reset={reset} />");
    expect(globalErrorSource).toContain("if (isChunkError)");
    expect(globalErrorSource).toContain("<AppErrorFallback reset={reset} />");
  });
});

// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
let polls = 0;
vi.mock("../infrastructure/desktop", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../infrastructure/desktop")>()),
  generate: async () => {
    throw new Error("Local worker failed");
  },
  generationProgress: async (jobId: string) => {
    polls++;
    return polls === 1
      ? null
      : {
          jobId,
          phase: "failed",
          message: "Backend initialization failed",
          imageIndex: 1,
          imageCount: 1,
          updatedAt: Date.now(),
          logs: [
            {
              at: Date.now(),
              message: "Model loader could not initialize the backend",
            },
          ],
        };
  },
}));
import { useStudio } from "./use-studio";
it("reads retained native logs when failure happens before the first polling interval", async () => {
  localStorage.clear();
  const { result } = renderHook(() => useStudio());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => {
    await result.current.createBrand("Diagnostic");
    await result.current.generate("local", 1);
  });
  expect(result.current.generationProgress?.phase).toBe("failed");
  expect(
    result.current.generationProgress?.logs.some((line) =>
      line.message.includes("Model loader"),
    ),
  ).toBe(true);
  expect(result.current.busy).toBe(false);
});
